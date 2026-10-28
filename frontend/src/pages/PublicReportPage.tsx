import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { createIdempotencyKey } from '../domain/ticket';
import {
  listarAmbientes, listarAreas, listarDocentes, listarFallas, listarPabellones, listarPisos,
  registrarIncidenciaPublica, type Ambiente, type CatalogItem, type Docente, type Falla, type Piso, type PublicReportInput,
} from '../features/public-report/public-report-service';

type Tipo = PublicReportInput['solicitanteTipo'];
const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';

function SearchSelect({ id, label, value, options, onChange, required = true }: { id: string; label: string; value: string; options: CatalogItem[]; onChange: (value: string) => void; required?: boolean }) {
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => option.nombre.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div>
    <label htmlFor={`${id}-search`} className="block text-sm font-medium text-slate-700">{label} {required ? <span className="text-red-600">*</span> : <span className="text-slate-400">(opcional)</span>}</label>
    <input id={`${id}-search`} className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar..." aria-label={`Buscar ${label.toLowerCase()}`} />
    <select id={id} className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} required={required} aria-label={label}>
      <option value="">Selecciona una opción</option>
      {filtered.map((option) => <option key={option.id} value={option.id}>{option.nombre}</option>)}
    </select>
  </div>;
}

function FieldError({ message }: { message?: string }) { return message ? <p role="alert" className="mt-1 text-xs text-red-700">{message}</p> : null; }

export function PublicReportPage() {
  const [tipo, setTipo] = useState<Tipo>('estudiante');
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [pabellones, setPabellones] = useState<CatalogItem[]>([]);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [areas, setAreas] = useState<CatalogItem[]>([]);
  const [fallas, setFallas] = useState<Falla[]>([]);
  const [form, setForm] = useState<PublicReportInput>({ solicitanteTipo: 'estudiante', solicitanteNombre: '', dni: '', correo: '', docenteId: '', areaId: '', fallaId: '', ambienteId: '', ubicacion: '', descripcion: '', claveIdempotencia: createIdempotencyKey() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ codigoSeguimiento: string; mensaje: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pabellonId, setPabellonId] = useState('');
  const [pisoId, setPisoId] = useState('');

  useEffect(() => {
    void Promise.all([listarDocentes(), listarPabellones(), listarPisos(), listarAmbientes(), listarAreas()]).then((values) => {
      const failed = values.find((item) => !item.ok);
      if (failed && !failed.ok) setError(failed.message);
      if (values[0].ok) setDocentes(values[0].data);
      if (values[1].ok) setPabellones(values[1].data);
      if (values[2].ok) setPisos(values[2].data);
      if (values[3].ok) setAmbientes(values[3].data);
      if (values[4].ok) setAreas(values[4].data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void listarFallas(tipo).then((value) => { if (value.ok) setFallas(value.data); else setError(value.message); });
  }, [tipo]);

  const selectedDocente = docentes.find((item) => item.id === form.docenteId);
  const filteredPisos = useMemo(() => pisos.filter((item) => !pabellonId || item.pabellon_id === pabellonId), [pisos, pabellonId]);
  const filteredAmbientes = useMemo(() => ambientes.filter((item) => !pisoId || item.piso_id === pisoId), [ambientes, pisoId]);

  function update(key: keyof PublicReportInput, value: string) { setForm((current) => ({ ...current, [key]: value })); setFieldErrors((current) => ({ ...current, [key]: '' })); }
  function changeTipo(value: Tipo) { setTipo(value); setFieldErrors({}); setPabellonId(''); setPisoId(''); setForm((current) => ({ ...current, solicitanteTipo: value, fallaId: '', docenteId: '', ambienteId: '', areaId: '', ubicacion: '', solicitanteNombre: '', dni: '', correo: '' })); }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (tipo === 'estudiante' && !/^\d{8}$/.test(form.dni)) next.dni = 'Ingresa un DNI de exactamente 8 dígitos.';
    if (tipo === 'docente' && !form.docenteId) next.docenteId = 'Selecciona un docente registrado.';
    if (tipo === 'docente' && !form.ambienteId) next.ambienteId = 'Selecciona el salón o ambiente.';
    if (tipo === 'administrativo' && !/^[^@\s]+@ottotonsman\.edu\.pe$/i.test(form.correo)) next.correo = 'Usa un correo institucional válido.';
    if (tipo === 'administrativo' && !form.areaId) next.areaId = 'Selecciona el área.';
    if (tipo === 'administrativo' && areas.find((area) => area.id === form.areaId)?.nombre === 'Otros' && form.solicitanteNombre.trim().length < 2) next.solicitanteNombre = 'Especifica el área.';
    if (!form.fallaId) next.fallaId = 'Selecciona una falla común.';
    if (fallas.find((item) => item.id === form.fallaId)?.nombre === 'Otro problema' && form.descripcion.trim().length < 5) next.descripcion = 'Describe obligatoriamente el problema.';
    if (form.descripcion.trim().length < 5) next.descripcion = 'Describe el problema con al menos 5 caracteres.';
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const next = validate(); setFieldErrors(next); if (Object.keys(next).length > 0) return;
    setSubmitting(true); setError(null);
    const location = tipo === 'docente' ? [pabellones.find((item) => item.id === pabellonId)?.nombre, pisos.find((item) => item.id === pisoId)?.nombre, ambientes.find((item) => item.id === form.ambienteId)?.nombre].filter(Boolean).join(' / ') : form.ubicacion;
    const response = await registrarIncidenciaPublica({ ...form, ubicacion: location, correo: selectedDocente?.correo_institucional ?? form.correo });
    setSubmitting(false); if (response.ok) setResult(response.data); else setError(response.message);
  }

  if (result) return <main className="min-h-screen bg-slate-50 px-4 py-10"><section className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto size-14 text-emerald-600" aria-hidden="true" /><h1 className="mt-4 text-2xl font-semibold text-slate-900">Incidencia registrada</h1><p className="mt-2 text-slate-600">{result.mensaje}</p><p className="mt-5 rounded-lg bg-slate-100 p-4 text-lg font-semibold text-slate-900">Código: {result.codigoSeguimiento}</p><p className="mt-4 text-sm text-slate-500">Conserva este código para consultar con el área de TI.</p><Link to="/reportar" className="mt-6 inline-flex rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Registrar otra incidencia</Link></section></main>;

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><section className="mx-auto max-w-3xl"><div className="mb-6"><p className="text-sm font-semibold uppercase tracking-wide text-blue-600">TI SmartDesk AI</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Reportar una incidencia</h1><p className="mt-2 text-sm leading-6 text-slate-600">Completa el formulario. No necesitas crear una cuenta.</p></div>{error ? <div role="alert" className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="size-5 shrink-0" aria-hidden="true" />{error}</div> : null}<form onSubmit={(event) => void submit(event)} noValidate className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div><label htmlFor="tipo" className="block text-sm font-medium text-slate-700">Tipo de usuario <span className="text-red-600">*</span></label><select id="tipo" className={inputClass} value={tipo} onChange={(event) => changeTipo(event.target.value as Tipo)}><option value="estudiante">Alumno</option><option value="docente">Docente</option><option value="administrativo">Administrativo</option></select></div>
    {tipo === 'estudiante' ? <div><label htmlFor="dni" className="block text-sm font-medium text-slate-700">DNI <span className="text-red-600">*</span></label><input id="dni" inputMode="numeric" maxLength={8} className={inputClass} value={form.dni} onChange={(event) => update('dni', event.target.value.replace(/\D/g, ''))} /><FieldError message={fieldErrors.dni} /></div> : null}
    {tipo === 'docente' ? <div className="grid gap-5 sm:grid-cols-2"><div><SearchSelect id="docente" label="Docente" value={form.docenteId} options={docentes} onChange={(value) => update('docenteId', value)} /><FieldError message={fieldErrors.docenteId} />{selectedDocente ? <p className="mt-1 text-xs text-slate-500">Correo: {selectedDocente.correo_institucional}</p> : null}</div><div><SearchSelect id="pabellon" label="Pabellón" value={pabellonId} options={pabellones} onChange={(value) => { setPabellonId(value); setPisoId(''); update('ambienteId', ''); }} required={false} /><SearchSelect id="piso" label="Piso" value={pisoId} options={filteredPisos} onChange={(value) => { setPisoId(value); update('ambienteId', ''); }} required={false} /><SearchSelect id="ambiente" label="Salón/Ambiente" value={form.ambienteId} options={filteredAmbientes} onChange={(value) => update('ambienteId', value)} /><FieldError message={fieldErrors.ambienteId} /></div></div> : null}
    {tipo === 'administrativo' ? <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="correo" className="block text-sm font-medium text-slate-700">Correo institucional <span className="text-red-600">*</span></label><input id="correo" type="email" className={inputClass} value={form.correo} onChange={(event) => update('correo', event.target.value)} /><FieldError message={fieldErrors.correo} /></div><div><SearchSelect id="area" label="Área" value={form.areaId} options={areas} onChange={(value) => update('areaId', value)} /><FieldError message={fieldErrors.areaId} /></div>{areas.find((area) => area.id === form.areaId)?.nombre === 'Otros' ? <div className="sm:col-span-2"><label htmlFor="otra-area" className="block text-sm font-medium text-slate-700">Especifica el área <span className="text-red-600">*</span></label><input id="otra-area" className={inputClass} value={form.solicitanteNombre} onChange={(event) => update('solicitanteNombre', event.target.value)} /><FieldError message={fieldErrors.solicitanteNombre} /></div> : null}</div> : null}
    <div><SearchSelect id="falla" label="Falla común" value={form.fallaId} options={fallas} onChange={(value) => update('fallaId', value)} /><FieldError message={fieldErrors.fallaId} /></div>
    {tipo !== 'docente' ? <div><label htmlFor="ubicacion-texto" className="block text-sm font-medium text-slate-700">Ubicación referencial <span className="text-slate-400">(opcional)</span></label><input id="ubicacion-texto" className={inputClass} value={form.ubicacion} onChange={(event) => update('ubicacion', event.target.value)} placeholder="Ej. laboratorio o pabellón" /></div> : null}
    <div><label htmlFor="descripcion" className="block text-sm font-medium text-slate-700">Descripción del problema <span className="text-red-600">*</span></label><textarea id="descripcion" rows={5} maxLength={4000} className={inputClass} value={form.descripcion} onChange={(event) => update('descripcion', event.target.value)} /><FieldError message={fieldErrors.descripcion} /></div>
    <button type="submit" disabled={loading || submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><Send className="size-4" aria-hidden="true" />{submitting ? 'Enviando...' : 'Enviar incidencia'}</button>
  </form></section></main>;
}
