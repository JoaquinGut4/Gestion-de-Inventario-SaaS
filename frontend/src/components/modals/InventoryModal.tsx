import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PackagePlus, Plus, Tags, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  CAMPOS_BASE_OPCIONALES,
  CAMPOS_BASE_OPCIONALES_KEYS,
  camposBaseHabilitados,
} from '@/lib/inventoryCategoryFields';
import type { CampoBaseOpcional } from '@/lib/inventoryCategoryFields';
import type {
  InventarioCategoria,
  InventarioCategoriaBaseId,
  InventarioCategoriaId,
  InventarioCampoPersonalizado,
  InventarioRegistro,
} from '@/types';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (registro: InventarioRegistro) => void;
  editingRegistro?: InventarioRegistro | null;
  onUpdate?: (registro: InventarioRegistro) => void;
  categorias: InventarioCategoria[];
  onCreateCategory: (categoria: InventarioCategoria) => void;
  estados: string[];
  existingSkus: string[];
  existingQrs: string[];
}

type CampoFormulario = Exclude<
  keyof InventarioRegistro,
  'id' | 'categoriaId' | 'categoria' | 'precio'
> | 'precio';

interface CampoConfig {
  key: CampoFormulario;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'file';
  required?: boolean;
  placeholder?: string;
  options?: string[];
  wide?: boolean;
}

const BASE_FIELDS: CampoConfig[] = [
  { key: 'sku', label: 'SKU', required: true, placeholder: 'Ej. LAP-0003' },
  { key: 'qr', label: 'Código QR', required: true, placeholder: 'Ej. QR-LAP-0003' },
  { key: 'foto', label: 'Foto del producto', type: 'file', wide: true },
  { key: 'marca', label: 'Marca', placeholder: 'Ej. HP, Lenovo, Samsung' },
  {
    key: 'descripcion',
    label: 'Descripción del equipo',
    placeholder: 'Modelo o línea específica',
    wide: true,
  },
  {
    key: 'numeroSerial',
    label: 'Número serial',
    placeholder: 'Código único del fabricante',
  },
];

const PURCHASE_FIELDS: CampoConfig[] = [
  { key: 'fechaCompra', label: 'Fecha de compra', type: 'date' },
  {
    key: 'facturaGuiaCompra',
    label: 'Factura / Guía de compra',
    placeholder: 'Ej. F001-000123',
  },
  { key: 'precio', label: 'Precio de compra (S/)', type: 'number' },
  { key: 'proveedor', label: 'Proveedor', placeholder: 'Empresa proveedora' },
  {
    key: 'ubicacion',
    label: 'Ubicación',
    type: 'select',
    options: ['Almacén 1', 'Almacén 2', 'Almacén 3', 'Taller', 'Alquilado'],
  },
  {
    key: 'estado',
    label: 'Estado',
    type: 'select',
    options: ['Disponible', 'Reservado', 'Despachado', 'Alquiler', 'Venta', 'Diagnóstico', 'Reparación', 'Reemplazo requerido', 'Reservado para reemplazo', 'Revisar', 'Baja'],
  },
  {
    key: 'observaciones',
    label: 'Observaciones',
    type: 'textarea',
    placeholder: 'Condición física, funcional o información adicional',
    wide: true,
  },
];

const SPECIFIC_FIELDS: Record<InventarioCategoriaBaseId, CampoConfig[]> = {
  laptops: [
    { key: 'procesador', label: 'Procesador', placeholder: 'Ej. Intel Core i5' },
    { key: 'ghz', label: 'GHz', placeholder: 'Ej. 2.50 GHz' },
    { key: 'generacion', label: 'Generación', placeholder: 'Ej. 11.ª' },
    { key: 'pantalla', label: 'Pantalla', placeholder: 'Ej. 15.6"' },
    { key: 'memoriaRam', label: 'Memoria RAM', placeholder: 'Ej. 8 GB' },
    { key: 'memoriaInterna', label: 'Memoria interna', placeholder: 'Ej. 512 GB' },
    {
      key: 'tipoMemoriaInterna',
      label: 'Tipo de memoria interna',
      type: 'select',
      options: ['SSD', 'HDD', 'NVMe', 'eMMC'],
    },
  ],
  computadoras: [
    { key: 'procesador', label: 'Procesador', placeholder: 'Ej. Intel Core i7' },
    { key: 'ghz', label: 'GHz', placeholder: 'Ej. 3.10 GHz' },
    { key: 'generacion', label: 'Generación', placeholder: 'Ej. 10.ª' },
    { key: 'memoriaRam', label: 'Memoria RAM', placeholder: 'Ej. 16 GB' },
    { key: 'memoriaInterna', label: 'Memoria interna', placeholder: 'Ej. 1 TB' },
    {
      key: 'tipoMemoriaInterna',
      label: 'Tipo de memoria interna',
      type: 'select',
      options: ['SSD', 'HDD', 'NVMe'],
    },
  ],
  monitores: [
    { key: 'pantalla', label: 'Pantalla', placeholder: 'Ej. 24"' },
    { key: 'alquiler', label: 'Disponible para alquiler', type: 'select', options: ['Sí', 'No'] },
  ],
  tablets: [
    { key: 'procesador', label: 'Procesador', placeholder: 'Ej. Apple A14 Bionic' },
    { key: 'generacion', label: 'Generación', placeholder: 'Ej. 10.ª' },
    { key: 'pantalla', label: 'Pantalla', placeholder: 'Ej. 10.9"' },
    { key: 'memoriaRam', label: 'Memoria RAM', placeholder: 'Ej. 4 GB' },
    { key: 'memoriaInterna', label: 'Memoria interna', placeholder: 'Ej. 64 GB' },
  ],
  televisores: [
    { key: 'modelo', label: 'Modelo', placeholder: 'Ej. UN55AU7000' },
    { key: 'pantalla', label: 'Pantalla', placeholder: 'Ej. 55"' },
  ],
  impresoras: [{ key: 'modelo', label: 'Modelo', placeholder: 'Ej. IM C3000' }],
  proyectores: [
    { key: 'item', label: 'Item', placeholder: 'Ej. Proyector láser' },
    { key: 'modelo', label: 'Modelo', placeholder: 'Ej. EB-L630U' },
  ],
};

const FIELD_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand';

const INITIAL_VALUES: Record<string, string> = {
  ubicacion: 'Almacén 1',
  estado: 'Disponible',
  tipoMemoriaInterna: 'SSD',
  alquiler: 'Sí',
};

const PREFIJOS_BASE: Record<string, string> = {
  laptops: 'LAP',
  computadoras: 'PC',
  monitores: 'MON',
  tablets: 'TAB',
  televisores: 'TV',
  impresoras: 'IMP',
  proyectores: 'PRO',
};

function prefijoCategoria(categoria: InventarioCategoria): string {
  if (PREFIJOS_BASE[categoria.id]) return PREFIJOS_BASE[categoria.id];
  const letras = categoria.label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 3);
  return letras || `C${categoria.codigo}`;
}

function generarIdentificadores(
  categoria: InventarioCategoria,
  existingSkus: string[],
): { sku: string; qr: string } {
  const prefijo = prefijoCategoria(categoria);
  const siguiente = existingSkus.reduce((max, sku) => {
    const [skuPrefijo, correlativo] = sku.toUpperCase().split('-');
    if (skuPrefijo !== prefijo || !correlativo || !/^\d+$/.test(correlativo)) return max;
    return Math.max(max, Number(correlativo));
  }, 0) + 1;
  const sku = `${prefijo}-${String(siguiente).padStart(4, '0')}`;
  return { sku, qr: `QR-${sku}` };
}

function optimizarFoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('El archivo no contiene una imagen válida.'));
      image.onload = () => {
        const maxSize = 1000;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.8));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function InventoryModal({
  isOpen,
  onClose,
  onCreate,
  editingRegistro = null,
  onUpdate,
  categorias,
  onCreateCategory,
  estados,
  existingSkus,
  existingQrs,
}: InventoryModalProps) {
  const [categoriaId, setCategoriaId] = useState<InventarioCategoriaId>('laptops');
  const [values, setValues] = useState<Record<string, string>>(INITIAL_VALUES);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCode, setNewCategoryCode] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [newSpecName, setNewSpecName] = useState('');
  const [newSpecType, setNewSpecType] = useState<InventarioCampoPersonalizado['type']>('text');
  const [newCategorySpecs, setNewCategorySpecs] = useState<InventarioCampoPersonalizado[]>([]);
  const [newCategoryBaseFields, setNewCategoryBaseFields] = useState<string[]>([
    ...CAMPOS_BASE_OPCIONALES_KEYS,
  ]);
  const [productError, setProductError] = useState('');
  const categoria = categorias.find((item) => item.id === categoriaId) ?? categorias[0];
  const specificFields = SPECIFIC_FIELDS[categoriaId as InventarioCategoriaBaseId] ?? [];
  const customFields = categoria.camposPersonalizados ?? [];
  const enabledBaseFields = new Set<CampoBaseOpcional>(camposBaseHabilitados(categoria));
  const baseFields = BASE_FIELDS.filter(
    (field) =>
      field.key === 'sku' ||
      field.key === 'qr' ||
      enabledBaseFields.has(field.key as CampoBaseOpcional),
  );
  const purchaseFields = PURCHASE_FIELDS.filter(
    (field) => field.key === 'ubicacion' || enabledBaseFields.has(field.key as CampoBaseOpcional),
  );
  const fields = [...baseFields, ...specificFields, ...purchaseFields];

  useEffect(() => {
    if (!isOpen) return;
    setProductError('');

    if (!editingRegistro) {
      const initialCategory =
        categorias.find((item) => item.id === 'laptops') ?? categorias[0];
      setCategoriaId(initialCategory.id);
      setValues({
        ...INITIAL_VALUES,
        ...generarIdentificadores(initialCategory, existingSkus),
      });
      return;
    }

    const nextValues: Record<string, string> = { ...INITIAL_VALUES };
    for (const [key, value] of Object.entries(editingRegistro)) {
      if (typeof value === 'string' || typeof value === 'number') {
        nextValues[key] = String(value);
      }
    }
    for (const [key, value] of Object.entries(
      editingRegistro.especificacionesPersonalizadas ?? {},
    )) {
      nextValues[`custom:${key}`] = value;
    }

    setCategoriaId(editingRegistro.categoriaId);
    setValues(nextValues);
  }, [editingRegistro, isOpen]);

  const updateValue = (key: CampoFormulario, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleCategoryChange = (nextCategory: InventarioCategoriaId) => {
    const selected = categorias.find((item) => item.id === nextCategory) ?? categoria;
    setCategoriaId(nextCategory);
    setValues({
      ...INITIAL_VALUES,
      ...generarIdentificadores(selected, existingSkus),
    });
  };

  const toggleNewCategoryBaseField = (key: CampoBaseOpcional) => {
    setNewCategoryBaseFields((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  const handleAddSpecification = () => {
    const label = newSpecName.trim();
    if (!label) return;
    if (newCategorySpecs.some((field) => field.label.toLowerCase() === label.toLowerCase())) {
      setCategoryError('Ya agregaste una especificación con ese nombre.');
      return;
    }

    const slug = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setNewCategorySpecs((current) => [
      ...current,
      { id: `${slug}-${Date.now()}`, label, type: newSpecType },
    ]);
    setNewSpecName('');
    setCategoryError('');
  };

  const handleCreateCategory = () => {
    const label = newCategoryName.trim();
    const codigo = Number(newCategoryCode);

    if (!label || !Number.isInteger(codigo) || codigo <= 0) {
      setCategoryError('Ingresa un nombre y un código numérico válido.');
      return;
    }
    if (categorias.some((item) => item.codigo === codigo)) {
      setCategoryError('El código ingresado ya pertenece a otra categoría.');
      return;
    }
    if (categorias.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      setCategoryError('Ya existe una categoría con ese nombre.');
      return;
    }

    const slug = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const nuevaCategoria: InventarioCategoria = {
      id: `custom-${slug}-${Date.now()}`,
      label,
      codigo,
      camposBase: newCategoryBaseFields,
      camposPersonalizados: newCategorySpecs,
    };

    onCreateCategory(nuevaCategoria);
    setCategoriaId(nuevaCategoria.id);
    setValues({
      ...INITIAL_VALUES,
      ...generarIdentificadores(nuevaCategoria, existingSkus),
    });
    setNewCategoryName('');
    setNewCategoryCode('');
    setNewCategorySpecs([]);
    setNewCategoryBaseFields([...CAMPOS_BASE_OPCIONALES_KEYS]);
    setNewSpecName('');
    setNewSpecType('text');
    setCategoryError('');
    setIsAddingCategory(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (existingSkus.some((sku) => sku.toLowerCase() === values.sku.trim().toLowerCase())) {
      setProductError('El SKU ingresado ya pertenece a otro producto.');
      return;
    }
    if (existingQrs.some((qr) => qr.toLowerCase() === values.qr.trim().toLowerCase())) {
      setProductError('El código QR ingresado ya pertenece a otro producto.');
      return;
    }

    const textValue = (key: string) => (values[key] ?? '').trim();
    const registro: InventarioRegistro = {
      id: editingRegistro?.id ?? `inv-${Date.now()}`,
      categoriaId,
      categoria: categoria.codigo,
      sku: textValue('sku'),
      qr: textValue('qr'),
      foto: values.foto ?? '',
      marca: textValue('marca'),
      descripcion: textValue('descripcion'),
      numeroSerial: textValue('numeroSerial'),
      fechaCompra: values.fechaCompra || null,
      facturaGuiaCompra: textValue('facturaGuiaCompra'),
      precio: Number(values.precio) || 0,
      proveedor: textValue('proveedor'),
      ubicacion: (values.ubicacion || 'Almacén 1') as InventarioRegistro['ubicacion'],
      estado: values.estado ?? estados[0] ?? '',
      observaciones: textValue('observaciones'),
    };

    for (const field of specificFields) {
      const value = values[field.key]?.trim();
      if (value) Object.assign(registro, { [field.key]: value });
    }

    if (customFields.length > 0) {
      registro.especificacionesPersonalizadas = Object.fromEntries(
        customFields.map((field) => [field.id, values[`custom:${field.id}`]?.trim() ?? '']),
      );
    }

    if (editingRegistro && onUpdate) {
      onUpdate(registro);
    } else {
      onCreate(registro);
    }
    setValues(INITIAL_VALUES);
    setProductError('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="inventory-modal-title"
      title={editingRegistro ? 'Editar producto del inventario' : 'Agregar producto al inventario'}
      subtitle={
        editingRegistro
          ? `Modifica cualquier dato del activo ${editingRegistro.sku}`
          : 'Registra la ficha técnica y los datos de adquisición del nuevo activo'
      }
      icon={<PackagePlus className="h-4 w-4" />}
      headerClass="bg-brand"
      panelClass="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
        <div className="rounded-xl border border-highlight/35 bg-brand-soft/60 p-4">
          <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
            Categoría del producto *
          </label>
          <div className="flex items-center gap-3">
            <select
              value={categoriaId}
              onChange={(event) => handleCategoryChange(event.target.value as InventarioCategoriaId)}
              className={FIELD_CLASS}
            >
              {categorias.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <span className="shrink-0 rounded-lg border border-highlight/65 bg-white px-3 py-2 text-xs font-bold text-brand">
              Código {categoria.codigo}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !isAddingCategory;
              setIsAddingCategory(next);
              if (next) {
                setNewCategoryBaseFields([...CAMPOS_BASE_OPCIONALES_KEYS]);
                const nextCode = Math.max(0, ...categorias.map((item) => item.codigo)) + 1;
                setNewCategoryCode(String(nextCode));
              }
              setCategoryError('');
            }}
            className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-highlight/65 bg-white px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:bg-brand-soft"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar nueva categoría
          </button>

          {isAddingCategory && (
            <div className="mt-3 rounded-xl border border-highlight/65 bg-white p-3 shadow-2xs">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800">
                <Tags className="h-4 w-4 text-brand" />
                Nueva categoría de inventario
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="Nombre de categoría"
                  className={FIELD_CLASS}
                />
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={newCategoryCode}
                  onChange={(event) => setNewCategoryCode(event.target.value)}
                  placeholder="Código"
                  className={FIELD_CLASS}
                />
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Campos por defecto de la categoría
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewCategoryBaseFields([...CAMPOS_BASE_OPCIONALES_KEYS])}
                      className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCategoryBaseFields([])}
                      className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {CAMPOS_BASE_OPCIONALES.map((campo) => {
                    const enabled = newCategoryBaseFields.includes(campo.key);
                    return (
                      <label
                        key={campo.key}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                          enabled
                            ? 'border-highlight/65 bg-brand-soft text-brand'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          onChange={() => toggleNewCategoryBaseField(campo.key)}
                        />
                        <span>{campo.label}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">
                  SKU y código QR se incluyen siempre. Desmarca los campos que esta categoría no necesite;
                  abajo puedes agregar campos propios.
                </p>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Especificaciones de la categoría
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_auto]">
                  <input
                    type="text"
                    value={newSpecName}
                    onChange={(event) => setNewSpecName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleAddSpecification();
                      }
                    }}
                    placeholder="Ej. Resolución, potencia, color"
                    className={FIELD_CLASS}
                  />
                  <select
                    value={newSpecType}
                    onChange={(event) => setNewSpecType(event.target.value as InventarioCampoPersonalizado['type'])}
                    className={FIELD_CLASS}
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="date">Fecha</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddSpecification}
                    className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-xl border border-highlight/65 bg-brand-soft px-3 py-2 text-xs font-bold text-brand hover:bg-highlight/25"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Añadir
                  </button>
                </div>

                {newCategorySpecs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {newCategorySpecs.map((field) => (
                      <span key={field.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                        {field.label}
                        <span className="text-[9px] uppercase text-slate-400">{field.type}</span>
                        <button
                          type="button"
                          onClick={() => setNewCategorySpecs((current) => current.filter((item) => item.id !== field.id))}
                          aria-label={`Eliminar especificación ${field.label}`}
                          className="cursor-pointer text-slate-400 hover:text-danger"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {categoryError && <p className="mt-2 text-[11px] font-semibold text-danger">{categoryError}</p>}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[10px] text-slate-500">
                  Podrás completar estas especificaciones al registrar productos en la categoría.
                </p>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="shrink-0 cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-900"
                >
                  Crear categoría
                </button>
              </div>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-slate-500">
            Los campos del formulario se adaptan automáticamente a la categoría seleccionada.
          </p>
        </div>

        <div className="rounded-xl border border-highlight/35 bg-brand-soft/60 px-3 py-2 text-[11px] font-medium text-brand">
          El SKU y el código QR se generan automáticamente según la categoría y el correlativo existente.
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <div key={field.key} className={field.wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                {field.label} {field.required && <span className="text-danger">*</span>}
              </label>

              {field.type === 'file' ? (
                <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 sm:flex-row sm:items-center">
                  {values.foto ? (
                    <img
                      src={values.foto}
                      alt="Vista previa del producto"
                      className="h-24 w-32 rounded-lg border border-slate-200 bg-white object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-32 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-400">
                      Sin foto
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.size > 8 * 1024 * 1024) {
                          setProductError('La foto original debe pesar como máximo 8 MB.');
                          event.target.value = '';
                          return;
                        }
                        try {
                          const foto = await optimizarFoto(file);
                          setValues((current) => ({ ...current, foto }));
                          setProductError('');
                        } catch (error) {
                          setProductError(error instanceof Error ? error.message : 'No se pudo procesar la foto.');
                        }
                      }}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-brand-deep"
                    />
                    <p className="mt-1.5 text-[10px] text-slate-500">PNG, JPG o WebP · Se optimiza automáticamente</p>
                    {values.foto && (
                      <button
                        type="button"
                        onClick={() => setValues((current) => ({ ...current, foto: '' }))}
                        className="mt-2 cursor-pointer text-[11px] font-bold text-danger hover:underline"
                      >
                        Quitar foto
                      </button>
                    )}
                  </div>
                </div>
              ) : field.type === 'select' ? (
                <select
                  required={field.required}
                  value={values[field.key] ?? (field.key === 'estado' ? estados[0] : field.options?.[0]) ?? ''}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  className={FIELD_CLASS}
                >
                  {(field.key === 'estado' ? estados : field.options)?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  rows={3}
                  required={field.required}
                  value={values[field.key] ?? ''}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className={FIELD_CLASS}
                />
              ) : (
                <input
                  type={field.type ?? 'text'}
                  min={field.type === 'number' ? '0' : undefined}
                  step={field.type === 'number' ? '0.01' : undefined}
                  required={field.required}
                  readOnly={field.key === 'sku' || field.key === 'qr'}
                  aria-readonly={field.key === 'sku' || field.key === 'qr'}
                  value={values[field.key] ?? ''}
                  onChange={(event) => updateValue(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className={`${FIELD_CLASS} ${
                    field.key === 'sku' || field.key === 'qr'
                      ? 'cursor-not-allowed bg-slate-100 font-mono font-bold text-slate-600'
                      : ''
                  }`}
                />
              )}
            </div>
          ))}

          {customFields.map((field) => (
            <div key={field.id}>
              <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                {field.label}
              </label>
              <input
                type={field.type}
                min={field.type === 'number' ? '0' : undefined}
                step={field.type === 'number' ? 'any' : undefined}
                value={values[`custom:${field.id}`] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [`custom:${field.id}`]: event.target.value,
                  }))
                }
                placeholder={`Ingresa ${field.label.toLowerCase()}`}
                className={FIELD_CLASS}
              />
            </div>
          ))}
        </div>

        {productError && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
            {productError}
          </p>
        )}

        <div className="sticky bottom-0 flex items-center justify-end gap-2.5 border-t border-slate-200 bg-white/95 pt-4 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-deep"
          >
            <PackagePlus className="h-3.5 w-3.5" />
            {editingRegistro ? 'Guardar cambios' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
