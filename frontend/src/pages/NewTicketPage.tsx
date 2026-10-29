import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Save } from 'lucide-react';
import {
  CANALES_MANUALES,
  SOLICITANTE_TIPOS,
  TICKET_LIMITS,
  createIdempotencyKey,
  getCanalOrigenLabel,
  getSolicitanteTipoLabel,
  hasValidationErrors,
  validateNuevoTicket,
  type CanalManual,
  type Categoria,
  type NuevoTicketErrores,
  type NuevoTicketInput,
  type SolicitanteTipo,
} from '../domain/ticket';
import { useAuth } from '../features/auth/use-auth';
import {
  crearTicket,
  listarCategorias,
} from '../features/tickets/ticket-service';

const INITIAL_FORM: NuevoTicketInput = {
  asunto: '',
  descripcion: '',
  categoriaId: '',
  solicitanteNombre: '',
  solicitanteTipo: 'docente',
  ubicacion: '',
  canalOrigen: 'manual',
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className="mt-1 text-xs text-red-700">
      {message}
    </p>
  );
}

export function NewTicketPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<NuevoTicketInput>(INITIAL_FORM);
  const [errors, setErrors] = useState<NuevoTicketErrores>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [idempotencyKey] = useState(createIdempotencyKey);

  useEffect(() => {
    let active = true;

    void listarCategorias().then((result) => {
      if (!active) {
        return;
      }

      setCategoriesLoading(false);

      if (!result.ok) {
        setCategoriesError(result.message);
        return;
      }

      setCategoriesError(null);
      setCategorias(result.data);

      const firstActive = result.data.find((categoria) => categoria.activo);

      if (firstActive) {
        setForm((current) =>
          current.categoriaId
            ? current
            : { ...current, categoriaId: firstActive.id },
        );
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const categoriasActivas = categorias.filter((categoria) => categoria.activo);

  function updateField<K extends keyof NuevoTicketInput>(
    key: K,
    value: NuevoTicketInput[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateNuevoTicket(form);
    setErrors(validation);

    if (hasValidationErrors(validation)) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await crearTicket(form, idempotencyKey);

    if (!result.ok) {
      setSubmitError(result.message);
      setSubmitting(false);
      return;
    }

    navigate(`/tickets/${result.data.id}`, { state: { created: true } });
  }

  if (profile?.rol !== 'admin' && profile?.rol !== 'tecnico') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">
          Registro reservado a técnicos
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-800">
          Tu perfil es de solo lectura para tickets. Un técnico activo debe
          registrar la incidencia.
        </p>
        <Link
          to="/tickets"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-900 underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la bandeja
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to="/tickets"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a la bandeja
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Registrar ticket
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          El ticket se crea en estado <strong>Nuevo</strong> y sin técnico
          asignado. Después podrás tomarlo, iniciar la atención y registrar la
          solución.
        </p>
      </div>

      {submitError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>{submitError}</p>
        </div>
      ) : null}

      {categoriesError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {categoriesError}
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div>
          <label
            htmlFor="asunto"
            className="block text-sm font-medium text-slate-700"
          >
            Asunto <span className="text-red-600">*</span>
          </label>
          <input
            id="asunto"
            type="text"
            value={form.asunto}
            onChange={(event) => updateField('asunto', event.target.value)}
            maxLength={TICKET_LIMITS.asuntoMax}
            aria-invalid={Boolean(errors.asunto)}
            aria-describedby={errors.asunto ? 'asunto-error' : undefined}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Resumen breve de la incidencia"
          />
          <FieldError id="asunto-error" message={errors.asunto} />
        </div>

        <div>
          <label
            htmlFor="descripcion"
            className="block text-sm font-medium text-slate-700"
          >
            Descripción <span className="text-red-600">*</span>
          </label>
          <textarea
            id="descripcion"
            value={form.descripcion}
            onChange={(event) => updateField('descripcion', event.target.value)}
            rows={5}
            maxLength={TICKET_LIMITS.descripcionMax}
            aria-invalid={Boolean(errors.descripcion)}
            aria-describedby={
              errors.descripcion ? 'descripcion-error' : undefined
            }
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="Describe el problema reportado por la persona."
          />
          <FieldError id="descripcion-error" message={errors.descripcion} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="categoria"
              className="block text-sm font-medium text-slate-700"
            >
              Categoría <span className="text-red-600">*</span>
            </label>
            <select
              id="categoria"
              value={form.categoriaId}
              onChange={(event) =>
                updateField('categoriaId', event.target.value)
              }
              disabled={categoriesLoading || categoriasActivas.length === 0}
              aria-invalid={Boolean(errors.categoriaId)}
              aria-describedby={
                errors.categoriaId ? 'categoria-error' : undefined
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                {categoriesLoading
                  ? 'Cargando categorías…'
                  : categoriasActivas.length === 0
                    ? 'Sin categorías activas'
                    : 'Selecciona una categoría'}
              </option>
              {categoriasActivas.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
            <FieldError id="categoria-error" message={errors.categoriaId} />
          </div>

          <div>
            <label
              htmlFor="solicitante-tipo"
              className="block text-sm font-medium text-slate-700"
            >
              Tipo de solicitante <span className="text-red-600">*</span>
            </label>
            <select
              id="solicitante-tipo"
              value={form.solicitanteTipo}
              onChange={(event) =>
                updateField(
                  'solicitanteTipo',
                  event.target.value as SolicitanteTipo,
                )
              }
              aria-invalid={Boolean(errors.solicitanteTipo)}
              aria-describedby={
                errors.solicitanteTipo ? 'solicitante-tipo-error' : undefined
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {SOLICITANTE_TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {getSolicitanteTipoLabel(tipo)}
                </option>
              ))}
            </select>
            <FieldError
              id="solicitante-tipo-error"
              message={errors.solicitanteTipo}
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="solicitante-nombre"
              className="block text-sm font-medium text-slate-700"
            >
              Nombre del solicitante{' '}
              <span className="text-red-600">*</span>
            </label>
            <input
              id="solicitante-nombre"
              type="text"
              value={form.solicitanteNombre}
              onChange={(event) =>
                updateField('solicitanteNombre', event.target.value)
              }
              maxLength={TICKET_LIMITS.solicitanteNombreMax}
              aria-invalid={Boolean(errors.solicitanteNombre)}
              aria-describedby={
                errors.solicitanteNombre
                  ? 'solicitante-nombre-error'
                  : undefined
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Nombre de la persona atendida"
            />
            <FieldError
              id="solicitante-nombre-error"
              message={errors.solicitanteNombre}
            />
          </div>

          <div>
            <label
              htmlFor="ubicacion"
              className="block text-sm font-medium text-slate-700"
            >
              Ubicación <span className="text-slate-400">(opcional)</span>
            </label>
            <input
              id="ubicacion"
              type="text"
              value={form.ubicacion}
              onChange={(event) => updateField('ubicacion', event.target.value)}
              maxLength={TICKET_LIMITS.ubicacionMax}
              aria-invalid={Boolean(errors.ubicacion)}
              aria-describedby={errors.ubicacion ? 'ubicacion-error' : undefined}
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Aula, oficina o laboratorio"
            />
            <FieldError id="ubicacion-error" message={errors.ubicacion} />
          </div>
        </div>

        <div className="sm:max-w-xs">
          <label
            htmlFor="canal-origen"
            className="block text-sm font-medium text-slate-700"
          >
            Canal de origen <span className="text-red-600">*</span>
          </label>
          <select
            id="canal-origen"
            value={form.canalOrigen}
            onChange={(event) =>
              updateField('canalOrigen', event.target.value as CanalManual)
            }
            aria-invalid={Boolean(errors.canalOrigen)}
            aria-describedby={
              errors.canalOrigen ? 'canal-origen-error' : undefined
            }
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            {CANALES_MANUALES.map((canal) => (
              <option key={canal} value={canal}>
                {getCanalOrigenLabel(canal)}
              </option>
            ))}
          </select>
          <FieldError id="canal-origen-error" message={errors.canalOrigen} />
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
          <Link
            to="/tickets"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={
              submitting ||
              categoriesLoading ||
              categoriasActivas.length === 0
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-4" aria-hidden="true" />
            {submitting ? 'Registrando…' : 'Registrar ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
