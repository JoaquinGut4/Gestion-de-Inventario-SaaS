import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Power, Trash2, UserPlus, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { NAV_ITEMS } from '@/config/navigation';
import { apiRequest } from '@/lib/api';
import type { AdminSection, UsuarioAdministrador, UsuarioRol } from '@/types';

const FIELD_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand';

const ROLES: UsuarioRol[] = ['Administrador', 'Operador', 'Consulta'];

const MODULOS_POR_ROL: Record<UsuarioRol, AdminSection[]> = {
  Administrador: NAV_ITEMS.map((item) => item.id),
  Operador: ['dashboard', 'inventario', 'movimientos', 'reportes'],
  Consulta: ['dashboard', 'reportes'],
};

interface ConfiguracionPageProps {
  currentUserId: string;
}

export function ConfiguracionPage({ currentUserId }: ConfiguracionPageProps) {
  const [users, setUsers] = useState<UsuarioAdministrador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioAdministrador | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UsuarioRol>('Administrador');
  const [telefono, setTelefono] = useState('');
  const [modulos, setModulos] = useState<AdminSection[]>(MODULOS_POR_ROL.Administrador);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<UsuarioAdministrador[]>('/usuarios')
      .then(setUsers)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'No se pudieron cargar los usuarios.'))
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setNombre('');
    setEmail('');
    setUsuario('');
    setPassword('');
    setRol('Administrador');
    setTelefono('');
    setModulos(MODULOS_POR_ROL.Administrador);
    setError('');
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const openEdit = (user: UsuarioAdministrador) => {
    setEditingUser(user);
    setNombre(user.nombre);
    setEmail(user.email);
    setUsuario(user.usuario);
    setPassword('');
    setRol(user.rol);
    setTelefono(user.telefono);
    setModulos(user.modulos);
    setError('');
    setIsModalOpen(true);
  };

  const cambiarRol = (nextRole: UsuarioRol) => {
    setRol(nextRole);
    setModulos(MODULOS_POR_ROL[nextRole]);
  };

  const toggleModule = (module: AdminSection) => {
    setModulos((current) =>
      current.includes(module) ? current.filter((item) => item !== module) : [...current, module],
    );
  };

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (users.some((item) => item.id !== editingUser?.id && item.email.toLowerCase() === email.trim().toLowerCase())) {
      setError('Ya existe una cuenta con ese correo.');
      return;
    }
    if (users.some((item) => item.id !== editingUser?.id && item.usuario.toLowerCase() === usuario.trim().toLowerCase())) {
      setError('El nombre de usuario ya está registrado.');
      return;
    }
    if (!telefono.trim()) {
      setError('Ingresa un número telefónico para la cuenta.');
      return;
    }
    if (modulos.length === 0) {
      setError('Activa al menos un módulo para la cuenta.');
      return;
    }
    if (password && password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (!editingUser && !password) {
      setError('Ingresa una contraseña para la nueva cuenta.');
      return;
    }

    const payload: Record<string, unknown> = {
      nombre: nombre.trim(),
      email: email.trim(),
      usuario: usuario.trim(),
      rol,
      telefono: telefono.trim(),
      activo: editingUser?.activo ?? true,
      modulos,
    };
    if (password) payload.password = password;

    try {
      if (editingUser) {
        const saved = await apiRequest<UsuarioAdministrador>(`/usuarios/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setUsers((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      } else {
        const created = await apiRequest<UsuarioAdministrador>('/usuarios', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setUsers((current) => [...current, created]);
      }
      closeModal();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo guardar el usuario.');
    }
  };

  const updateUser = async (id: string, update: (user: UsuarioAdministrador) => UsuarioAdministrador) => {
    const current = users.find((user) => user.id === id);
    if (!current) return;
    const next = update(current);
    try {
      const saved = await apiRequest<UsuarioAdministrador>(`/usuarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: next.activo, modulos: next.modulos }),
      });
      setUsers((items) => items.map((user) => (user.id === id ? saved : user)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo actualizar el usuario.');
    }
  };

  const deleteUser = async (user: UsuarioAdministrador) => {
    if (user.id === currentUserId) {
      setError('No puedes eliminar tu propia cuenta.');
      return;
    }
    const confirmed = window.confirm(
      `¿Eliminar la cuenta de ${user.nombre} (${user.usuario})? Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;

    try {
      await apiRequest<void>(`/usuarios/${user.id}`, { method: 'DELETE' });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo eliminar el usuario.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Usuarios administradores</h2>
            <span className="rounded-full border border-highlight/65 bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
              {users.length} cuentas
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Crea, edita y elimina cuentas administrativas, y controla sus módulos
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-bold text-white hover:bg-brand-deep"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{error}</p>}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Cargando usuarios...</div>
      ) : users.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center">
          <Users className="h-9 w-9 text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600">No hay usuarios adicionales</p>
          <p className="mt-1 text-xs text-slate-500">Crea una cuenta para configurar su acceso por módulos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <article key={user.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{user.nombre}</p>
                    <span className="rounded bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">{user.rol}</span>
                    {user.superAdmin && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Superadministrador</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{user.email} · {user.usuario}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{user.telefono || 'Sin teléfono registrado'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(user)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-highlight/65 bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand hover:bg-highlight/25"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteUser(user)}
                    disabled={user.id === currentUserId}
                    title={user.id === currentUserId ? 'No puedes eliminar tu propia cuenta' : `Eliminar ${user.usuario}`}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateUser(user.id, (current) => ({ ...current, activo: !current.activo }))}
                    className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold ${
                      user.activo
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-slate-200 bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {user.activo ? 'Cuenta activa' : 'Cuenta inactiva'}
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Módulos habilitados</p>
                <div className="flex flex-wrap gap-2">
                  {NAV_ITEMS.map((module) => {
                    const enabled = user.modulos.includes(module.id);
                    return (
                      <button
                        key={module.id}
                        type="button"
                        onClick={() =>
                          void updateUser(user.id, (current) => ({
                            ...current,
                            modulos: enabled
                              ? current.modulos.filter((item) => item !== module.id)
                              : [...current.modulos, module.id],
                          }))
                        }
                        className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${
                          enabled
                            ? 'border-highlight/65 bg-brand-soft text-brand'
                            : 'border-slate-200 bg-white text-slate-400'
                        }`}
                      >
                        {module.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        labelledBy="admin-user-modal-title"
        title={editingUser ? 'Editar usuario' : 'Crear usuario administrador'}
        subtitle={editingUser ? 'Actualiza los datos, rol, teléfono o módulos de la cuenta' : 'Define credenciales, rol, teléfono y módulos habilitados'}
        icon={editingUser ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        headerClass="bg-brand"
        panelClass="max-w-2xl"
      >
        <form onSubmit={saveUser} className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Nombre completo *</label>
              <input required value={nombre} onChange={(event) => setNombre(event.target.value)} className={FIELD_CLASS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Correo *</label>
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className={FIELD_CLASS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Usuario *</label>
              <input required value={usuario} onChange={(event) => setUsuario(event.target.value)} className={FIELD_CLASS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Número telefónico *</label>
              <input
                type="tel"
                required
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                placeholder="+51 900 000 000"
                className={FIELD_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">Rol *</label>
              <select
                required
                value={rol}
                onChange={(event) => cambiarRol(event.target.value as UsuarioRol)}
                className={FIELD_CLASS}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                {editingUser ? 'Nueva contraseña' : 'Contraseña *'}
              </label>
              <input
                type="password"
                minLength={8}
                required={!editingUser}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={editingUser ? 'Dejar vacío para mantener la actual' : undefined}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div>
            <div className="mb-2">
              <p className="text-xs font-bold uppercase text-slate-600">Módulos disponibles *</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Se preseleccionan según el rol; puedes ajustarlos.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {NAV_ITEMS.map((module) => {
                const enabled = modulos.includes(module.id);
                return (
                  <label key={module.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-xs font-semibold ${enabled ? 'border-highlight/65 bg-brand-soft text-brand' : 'border-slate-200 text-slate-500'}`}>
                    <input type="checkbox" checked={enabled} onChange={() => toggleModule(module.id)} />
                    {module.label}
                  </label>
                );
              })}
            </div>
          </div>

          {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={closeModal} className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="submit" className="cursor-pointer rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white hover:bg-brand-deep">
              {editingUser ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
