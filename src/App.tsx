import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Receipt, 
  BarChart3, 
  Settings,
  Menu,
  X,
  Search,
  Plus,
  Building2,
  User,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Home,
  Info,
  FileSearch,
  Upload,
  Loader2,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { Contract, Transaction, Receipt as ReceiptType, Property } from './types';

// --- Mock Data ---
const MOCK_PROPERTIES: Property[] = [
  { id: 'P1', address: 'Billinghurst 2059', unit: '3C', ownerName: 'Relik SRL', type: 'Departamento', floor: '3', m2: 45 },
  { id: 'P2', address: 'Av. Callao 1103', unit: '12', ownerName: 'Relik SRL', type: 'Departamento', floor: '12', m2: 60 },
  { id: 'P3', address: 'Parana 1037', unit: '9D', ownerName: 'Relik SRL', type: 'Departamento', floor: '9', m2: 38 },
];
const MOCK_CONTRACTS: Contract[] = [
  {
    id: '1',
    propertyId: 'P1',
    tenantId: 'T1',
    startDate: '2025-12-01',
    endDate: '2027-11-30',
    currency: 'ARS',
    monthlyAmount: 900000,
    status: 'Vigente',
    destination: 'Vivienda',
    guarantorName: 'Pablo Alejandro Cabilla',
    securityDeposit: 900000,
    services: ['AySA', 'Expensas Comunes', 'Municipal']
  },
  {
    id: '2',
    propertyId: 'P2',
    tenantId: 'T2',
    startDate: '2024-01-01',
    endDate: '2026-01-01',
    currency: 'USD',
    monthlyAmount: 1200,
    status: 'Vigente',
    destination: 'Comercial',
    securityDeposit: 2400,
    services: ['Luz', 'Gas']
  }
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', date: '2026-03-01', type: 'Ingreso', concept: 'Alquiler 03/2026 - Billinghurst 2059', amount: 900000, currency: 'ARS', status: 'Pagado', receiptNumber: 'FC A 0004-00000015' },
  { id: '2', date: '2026-03-01', type: 'Ingreso', concept: 'Expensas Enero 2026', amount: 416686.12, currency: 'ARS', status: 'Pagado' },
  { id: '3', date: '2026-03-02', type: 'Egreso', concept: 'Pintura y materiales - Depto 3C', amount: 2400000, currency: 'ARS', status: 'Pagado', receiptNumber: 'FC A 0001-00000005' },
];

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ label, value, subValue, icon: Icon, color }: { label: string, value: string, subValue?: string, icon: any, color: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm card-hover">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      {subValue && <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{subValue}</span>}
    </div>
    <h3 className="text-slate-500 text-sm font-medium mb-1">{label}</h3>
    <p className="text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

const SectionHeader = ({ title, description, onAdd }: { title: string, description: string, onAdd?: () => void }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
    <div>
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
      <p className="text-slate-500 mt-1">{description}</p>
    </div>
    {onAdd && (
      <button 
        onClick={onAdd}
        className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm"
      >
        <Plus size={20} />
        Nuevo Registro
      </button>
    )}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'new' | 'ai-process'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [unitDetailTab, setUnitDetailTab] = useState<'info' | 'ingresos' | 'egresos' | 'comprobantes' | 'contrato'>('info');
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imputationType, setImputationType] = useState<'unidad' | 'contrato'>('unidad');
  const [aiError, setAiError] = useState<string | null>(null);

  const processInvoiceWithAI = async (base64Image: string, mimeType: string) => {
    setIsProcessingAI(true);
    setAiError(null);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("La API Key de Gemini no está configurada en el entorno.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Using gemini-flash-latest as recommended for basic text/extraction tasks
      const responsePromise = ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          {
            parts: [
              { text: "Analiza esta factura de Argentina. Extrae la información en formato JSON. Campos: numero_factura (punto de venta y número), fecha (YYYY-MM-DD), cuit_emisor, nombre_emisor, detalle, monto_total (número), moneda (ARS o USD), categoria (Mantenimiento, Servicios, Impuestos, Otros)." },
              { inlineData: { mimeType: mimeType, data: base64Image.split(',')[1] } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              numero_factura: { type: Type.STRING },
              fecha: { type: Type.STRING },
              cuit_emisor: { type: Type.STRING },
              nombre_emisor: { type: Type.STRING },
              detalle: { type: Type.STRING },
              monto_total: { type: Type.NUMBER },
              moneda: { type: Type.STRING },
              categoria: { type: Type.STRING }
            },
            required: ["numero_factura", "fecha", "monto_total"]
          }
        }
      });

      // Note: The @google/genai SDK might not support AbortSignal directly in all versions, 
      // but we can use a Promise.race for the timeout logic.
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Tiempo de espera agotado al procesar la factura (30s).")), 30000)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      clearTimeout(timeoutId);

      const text = response.text;
      if (!text) {
        throw new Error("La IA no devolvió ningún texto. Por favor, intenta con otra imagen.");
      }
      
      try {
        const result = JSON.parse(text);
        setAiResult(result);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Text:", text);
        throw new Error("Error al interpretar la respuesta de la IA.");
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Error processing AI:", error);
      let errorMessage = "Error al procesar la factura.";
      
      if (error.name === 'AbortError' || error.message?.includes("Tiempo de espera")) {
        errorMessage = "La operación tardó demasiado. Por favor, intenta de nuevo con una imagen más pequeña o nítida.";
      } else if (error.message?.includes("API key")) {
        errorMessage = "Error de configuración: API Key no válida.";
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setAiError(errorMessage);
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setUploadedImage(base64);
        processInvoiceWithAI(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const navigateTo = (tab: string, mode: 'list' | 'detail' | 'new' | 'ai-process' = 'list', id: string | null = null) => {
    setActiveTab(tab);
    setViewMode(mode);
    setSelectedId(id);
    setExpandedUnit(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const renderContractDetail = (id: string) => {
    const contract = MOCK_CONTRACTS.find(c => c.id === id) || MOCK_CONTRACTS[0];
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={24} />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Detalle de Contrato: {contract.propertyId}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-brand-600" /> Datos Principales
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Inquilino</p>
                  <p className="text-sm font-medium text-slate-900">Sergio Mur y Marilen Sanabria</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Inicio</p>
                  <p className="text-sm font-medium text-slate-900">{contract.startDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Fin</p>
                  <p className="text-sm font-medium text-slate-900">{contract.endDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Moneda</p>
                  <p className="text-sm font-medium text-slate-900">{contract.currency}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Monto</p>
                  <p className="text-sm font-bold text-brand-600">{contract.currency} {contract.monthlyAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Destino</p>
                  <p className="text-sm font-medium text-slate-900">{contract.destination}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Settings size={18} className="text-brand-600" /> Servicios Reembolsables
              </h3>
              <div className="flex flex-wrap gap-2">
                {contract.services.map(s => (
                  <span key={s} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <User size={18} className="text-brand-600" /> Garantías
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase">Garante</p>
              <p className="text-sm font-medium text-slate-900 mb-4">{contract.guarantorName}</p>
              <p className="text-xs text-slate-400 font-bold uppercase">Bienes</p>
              <p className="text-xs text-slate-500 leading-relaxed">Tte. Gral Juan Domingo Peron 4165, 4169, 4171, 4173, 4177, 4179, 4185 entre palestina y agaces UF 118 Piso 4 Of 7 sec 17</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                <DollarSign size={18} className="text-brand-600" /> Depósito en Garantía
              </h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500">Monto:</span>
                <span className="text-sm font-bold text-slate-900">{contract.currency} {contract.securityDeposit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-slate-500">Fecha Pago:</span>
                <span className="text-sm font-medium text-slate-700">11/12/2025</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNewForm = (type: string) => {
    const isContract = type === 'contrato';
    const isReceipt = type === 'comprobante';
    const isIncome = type === 'ingreso';
    const isExpense = type === 'egreso';
    const isUnidad = type === 'unidade' || type === 'unidad';
    
    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Nuevo {isUnidad ? 'Unidad' : type.charAt(0).toUpperCase() + type.slice(1)}</h2>
            <p className="text-slate-500 text-sm">Complete los campos para registrar el nuevo {isUnidad ? 'unidad' : type}.</p>
          </div>
          <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {isUnidad && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Dirección</label>
                  <input type="text" placeholder="Ej: Billinghurst 2059..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Unidad / Depto</label>
                  <input type="text" placeholder="Ej: 3C..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Propietario</label>
                  <input type="text" placeholder="Nombre del propietario..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Tipo</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium">
                    <option>Departamento</option>
                    <option>Local</option>
                    <option>Oficina</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Superficie (m2)</label>
                  <input type="number" placeholder="0" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Piso</label>
                  <input type="text" placeholder="Ej: 3..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
              </>
            )}

            {isContract && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Propiedad / Unidad</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium">
                    {MOCK_PROPERTIES.map(p => <option key={p.id}>{p.address} {p.unit}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Inquilino</label>
                  <input type="text" placeholder="Nombre completo..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Fecha Fin</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Destino</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium">
                    <option>Vivienda</option>
                    <option>Comercial</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Garante</label>
                  <input type="text" placeholder="Nombre del garante..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
              </>
            )}

            {isReceipt && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Proveedor</label>
                  <input type="text" placeholder="Nombre o CUIT..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Tipo Comprobante</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium">
                    <option>Factura A</option>
                    <option>Factura B</option>
                    <option>Factura C</option>
                    <option>Recibo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Número</label>
                  <input type="text" placeholder="0000-00000000" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-mono font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Fecha Emisión</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
              </>
            )}

            {(isIncome || isExpense) && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Unidad Relacionada</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium">
                    {MOCK_PROPERTIES.map(p => <option key={p.id}>{p.address} {p.unit}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Fecha</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Concepto</label>
                  <input type="text" placeholder="Ej: Alquiler Marzo 2026..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium" />
                </div>
              </>
            )}
            
            {!isUnidad && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Monto</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                    <input type="number" placeholder="0.00" className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Moneda</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-medium">
                    <option>ARS - Pesos Argentinos</option>
                    <option>USD - Dólares Estadounidenses</option>
                  </select>
                </div>
              </>
            )}
          </div>
          
          <div className="flex gap-4 pt-6">
            <button type="button" onClick={() => setViewMode('list')} className="flex-1 py-4 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
              Guardar {isUnidad ? 'Unidad' : type}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderTransactionDetail = (id: string) => {
    const t = MOCK_TRANSACTIONS.find(x => x.id === id) || MOCK_TRANSACTIONS[0];
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        <div className={`p-8 text-center ${t.type === 'Ingreso' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <div className="flex justify-between items-start mb-6">
            <button onClick={() => setViewMode('list')} className="p-2 hover:bg-white/50 rounded-full text-slate-500">
              <X size={20} />
            </button>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${t.type === 'Ingreso' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'}`}>
              {t.type}
            </span>
            <div className="w-10"></div>
          </div>
          <p className="text-slate-500 font-medium mb-1">Monto Total</p>
          <h2 className={`text-4xl font-black ${t.type === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {t.currency} {t.amount.toLocaleString()}
          </h2>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Fecha</p>
              <p className="text-sm font-bold text-slate-900">{t.date}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Comprobante</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{t.receiptNumber || 'Sin comprobante'}</p>
            </div>
          </div>
          
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase mb-1">Concepto</p>
            <p className="text-sm font-medium text-slate-700 leading-relaxed">{t.concept}</p>
          </div>

          <div className="pt-6 border-t border-slate-50 flex gap-4">
            <button className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm">Imprimir Recibo</button>
            <button className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-sm text-slate-600">Compartir</button>
          </div>
        </div>
      </div>
    );
  };

  const renderReceiptDetail = (id: string) => {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={24} />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Detalle de Comprobante #{id}</h2>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-50 bg-slate-50/50">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Proveedor</p>
                <h3 className="text-xl font-bold text-slate-900">Diego Ramon Torrez Ortiz</h3>
                <p className="text-sm text-slate-500">CUIT: 20-94509056-2 | IVA Inscripto</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 font-bold uppercase mb-1">Tipo</p>
                <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold">FC A</span>
              </div>
            </div>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Fecha</p>
              <p className="text-sm font-bold text-slate-900">16/01/2026</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Número</p>
              <p className="text-sm font-bold text-slate-900 font-mono">0004-00000015</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase mb-1">Importe Total</p>
              <p className="text-xl font-black text-slate-900">ARS 2.904.000,00</p>
            </div>
          </div>

          <div className="p-8 border-t border-slate-50">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Imputación / Conceptos</h4>
            <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-slate-600 font-medium">Saldo final trabajo Parana 1037 9D</span>
              <span className="text-sm font-bold text-slate-900">ARS 2.400.000,00</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUnidadDetail = (id: string) => {
    const property = MOCK_PROPERTIES.find(p => p.id === id) || MOCK_PROPERTIES[0];
    const contract = MOCK_CONTRACTS.find(c => c.propertyId === id);
    const transactions = MOCK_TRANSACTIONS; // In a real app, filter by propertyId

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{property.address} {property.unit}</h2>
            <p className="text-slate-500 text-sm">Detalle integral de la unidad</p>
          </div>
        </div>

        <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
          {[
            { id: 'info', label: 'Información', icon: Info },
            { id: 'ingresos', label: 'Ingresos', icon: ArrowUpRight },
            { id: 'egresos', label: 'Egresos', icon: ArrowDownLeft },
            { id: 'comprobantes', label: 'Comprobantes', icon: Receipt },
            { id: 'contrato', label: 'Contrato', icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setUnitDetailTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                unitDetailTab === tab.id 
                  ? 'border-brand-600 text-brand-600 bg-brand-50/50' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {unitDetailTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Dirección</p>
                <p className="text-sm font-bold text-slate-900">{property.address}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Unidad</p>
                <p className="text-sm font-bold text-slate-900">{property.unit}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Propietario</p>
                <p className="text-sm font-bold text-slate-900">{property.ownerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Tipo</p>
                <p className="text-sm font-bold text-slate-900">{property.type}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Superficie</p>
                <p className="text-sm font-bold text-slate-900">{property.m2} m²</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase mb-2">Piso</p>
                <p className="text-sm font-bold text-slate-900">{property.floor || '-'}</p>
              </div>
            </div>
          )}

          {unitDetailTab === 'ingresos' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.filter(t => t.type === 'Ingreso').map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.concept}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-emerald-600">
                        {t.currency} {t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unitDetailTab === 'egresos' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transactions.filter(t => t.type === 'Egreso').map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.concept}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-rose-600">
                        {t.currency} {t.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unitDetailTab === 'comprobantes' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Proveedor</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[1, 2].map((i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">Diego Ramon Torrez Ortiz</td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">FCA 0004-0000001{i}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-slate-900">$ 2.904.000,00</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unitDetailTab === 'contrato' && (
            contract ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2">Inquilino</p>
                  <p className="text-sm font-bold text-slate-900">Sergio Mur y Marilen Sanabria</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2">Vigencia</p>
                  <p className="text-sm font-bold text-slate-900">{contract.startDate} al {contract.endDate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2">Monto Mensual</p>
                  <p className="text-lg font-black text-brand-600">{contract.currency} {contract.monthlyAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase mb-2">Estado</p>
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg uppercase">{contract.status}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500">No hay un contrato vigente para esta unidad.</p>
                <button onClick={() => navigateTo('contratos', 'new')} className="mt-4 text-brand-600 font-bold hover:underline">Crear nuevo contrato</button>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  const renderAIInvoiceProcessor = () => {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewMode('list')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
              <X size={24} />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="text-brand-500" size={24} /> Procesar Factura con IA
              </h2>
              <p className="text-slate-500 text-sm">Sube una factura para extraer datos automáticamente.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all ${uploadedImage ? 'border-brand-200 bg-brand-50/30' : 'border-slate-200 hover:border-brand-400 bg-white'}`}>
              {!uploadedImage ? (
                <>
                  <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 mb-4">
                    <Upload size={32} />
                  </div>
                  <p className="text-slate-900 font-bold mb-1">Arrastra tu factura aquí</p>
                  <p className="text-slate-500 text-sm mb-6">Soporta JPG, PNG o PDF (imagen)</p>
                  <label className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-slate-800 transition-all">
                    Seleccionar Archivo
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                  </label>
                </>
              ) : (
                <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden shadow-lg border border-slate-200">
                  <img src={uploadedImage} alt="Invoice preview" className="w-full h-full object-contain bg-white" />
                  <button 
                    onClick={() => { setUploadedImage(null); setAiResult(null); setAiError(null); }}
                    className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur rounded-full shadow-lg text-rose-500 hover:bg-rose-50"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>

            {isProcessingAI && (
              <div className="flex items-center gap-3 p-4 bg-brand-50 text-brand-700 rounded-2xl border border-brand-100 animate-pulse">
                <Loader2 className="animate-spin" size={20} />
                <span className="font-medium">La IA está analizando el documento...</span>
              </div>
            )}

            {aiError && (
              <div className="flex flex-col gap-3 p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-100">
                <div className="flex items-center gap-2">
                  <Info size={20} />
                  <span className="font-bold">Error de Procesamiento</span>
                </div>
                <p className="text-sm">{aiError}</p>
                <button 
                  onClick={() => {
                    if (uploadedImage) {
                      const mimeType = uploadedImage.split(';')[0].split(':')[1];
                      processInvoiceWithAI(uploadedImage, mimeType);
                    }
                  }}
                  className="w-fit px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors"
                >
                  Reintentar
                </button>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <FileSearch className="text-slate-400" size={20} /> Datos Extraídos
              </h3>

              {!aiResult && !isProcessingAI && (
                <div className="py-12 text-center space-y-2">
                  <p className="text-slate-400 text-sm">Sube una factura para ver los resultados aquí.</p>
                </div>
              )}

              {aiResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nro Factura</label>
                      <input 
                        type="text" 
                        value={aiResult.numero_factura} 
                        onChange={(e) => setAiResult({...aiResult, numero_factura: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Fecha</label>
                      <input 
                        type="date" 
                        value={aiResult.fecha} 
                        onChange={(e) => setAiResult({...aiResult, fecha: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Emisor</label>
                    <input 
                      type="text" 
                      value={aiResult.nombre_emisor} 
                      onChange={(e) => setAiResult({...aiResult, nombre_emisor: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold"
                    />
                    <p className="text-[10px] text-slate-400 font-medium">CUIT: {aiResult.cuit_emisor}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Detalle / Concepto</label>
                    <textarea 
                      value={aiResult.detalle} 
                      onChange={(e) => setAiResult({...aiResult, detalle: e.target.value})}
                      rows={2}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Monto</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input 
                          type="number" 
                          value={aiResult.monto_total} 
                          onChange={(e) => setAiResult({...aiResult, monto_total: parseFloat(e.target.value)})}
                          className="w-full pl-7 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-black"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Categoría</label>
                      <select 
                        value={aiResult.categoria} 
                        onChange={(e) => setAiResult({...aiResult, categoria: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-bold"
                      >
                        <option>Mantenimiento</option>
                        <option>Servicios</option>
                        <option>Impuestos</option>
                        <option>Otros</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-50 space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Imputación del Gasto</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setImputationType('unidad')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${imputationType === 'unidad' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'}`}
                      >
                        <Home size={20} />
                        <span className="text-xs font-bold">A la Unidad</span>
                        <span className="text-[10px] opacity-70">Gasto de Propietario</span>
                      </button>
                      <button 
                        onClick={() => setImputationType('contrato')}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${imputationType === 'contrato' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-100 hover:border-slate-200 text-slate-600'}`}
                      >
                        <FileText size={20} />
                        <span className="text-xs font-bold">Al Contrato</span>
                        <span className="text-[10px] opacity-70">Reembolso Inquilino</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        {imputationType === 'unidad' ? 'Seleccionar Unidad' : 'Seleccionar Contrato'}
                      </label>
                      <select className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm font-medium">
                        {imputationType === 'unidad' 
                          ? MOCK_PROPERTIES.map(p => <option key={p.id}>{p.address} {p.unit}</option>)
                          : MOCK_CONTRACTS.map(c => <option key={c.id}>Contrato #{c.id} - {MOCK_PROPERTIES.find(p => p.id === c.propertyId)?.address}</option>)
                        }
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      // Here we would save the transaction
                      setViewMode('list');
                      setAiResult(null);
                      setUploadedImage(null);
                    }}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} /> Confirmar y Registrar Egreso
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (viewMode === 'ai-process') return renderAIInvoiceProcessor();

    if (viewMode === 'detail' && selectedId) {
      if (activeTab === 'unidades') return renderUnidadDetail(selectedId);
      if (activeTab === 'contratos') return renderContractDetail(selectedId);
      if (activeTab === 'ingresos' || activeTab === 'egresos') return renderTransactionDetail(selectedId);
      if (activeTab === 'comprobantes') return renderReceiptDetail(selectedId);
    }

    if (viewMode === 'new') {
      return renderNewForm(activeTab.slice(0, -1));
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-8">
            <SectionHeader title="Panel de Control" description="Resumen general de la administración." />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Ingresos del Mes" value="$ 2.533.052" subValue="ARS" icon={ArrowUpRight} color="bg-emerald-500" />
              <StatCard label="Egresos del Mes" value="$ 2.400.000" subValue="ARS" icon={ArrowDownLeft} color="bg-rose-500" />
              <StatCard label="Contratos Activos" value="42" icon={FileText} color="bg-blue-500" />
              <StatCard label="Pendientes de Cobro" value="5" icon={Calendar} color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-bottom border-slate-50 flex justify-between items-center">
                  <h2 className="font-bold text-slate-900">Últimos Movimientos</h2>
                  <button className="text-sm text-brand-600 font-semibold hover:underline">Ver todos</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {MOCK_TRANSACTIONS.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigateTo(t.type === 'Ingreso' ? 'ingresos' : 'egresos', 'detail', t.id)}>
                          <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.concept}</td>
                          <td className={`px-6 py-4 text-sm font-bold ${t.type === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {t.type === 'Ingreso' ? '+' : '-'} {t.currency} {t.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h2 className="font-bold text-slate-900 mb-6">Vencimientos Próximos</h2>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Building2 size={20} className="text-slate-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900">Billinghurst 2059 3C</p>
                        <p className="text-xs text-slate-500">Vence el 05/03/2026</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-brand-600">ARS 900k</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 'unidades':
        return (
          <div className="space-y-6">
            <SectionHeader title="Unidades" description="Gestión y métricas por propiedad." onAdd={() => setViewMode('new')} />
            
            <div className="grid grid-cols-1 gap-4">
              {MOCK_PROPERTIES.map(property => {
                const isExpanded = expandedUnit === property.id;
                const contract = MOCK_CONTRACTS.find(c => c.propertyId === property.id);
                
                return (
                  <div key={property.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300">
                    <div 
                      className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => setExpandedUnit(isExpanded ? null : property.id)}
                    >
                      <div className="p-4 bg-slate-900 rounded-2xl text-white">
                        <Home size={32} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{property.address} {property.unit}</h3>
                            <p className="text-sm text-slate-500">{property.ownerName} • {property.type}</p>
                          </div>
                          <div className="text-right hidden md:block">
                            <p className="text-xs text-slate-400 font-bold uppercase">Ganancia Prom. Mensual</p>
                            <p className="text-lg font-black text-emerald-600">ARS 450.000</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Ingresos</p>
                            <p className="text-sm font-bold text-emerald-600">ARS 900.000</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Gastos Imputados</p>
                            <p className="text-sm font-bold text-rose-600">ARS 450.000</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">Gastos No Imput.</p>
                            <p className="text-sm font-bold text-slate-400">ARS 0</p>
                          </div>
                          <div className="flex items-center justify-end">
                            {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                          </div>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-50 bg-slate-50/30 overflow-hidden"
                        >
                          <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Detalles de la Unidad</h4>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Piso</p>
                                    <p className="text-sm font-medium text-slate-700">{property.floor || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">M2</p>
                                    <p className="text-sm font-medium text-slate-700">{property.m2} m²</p>
                                  </div>
                                </div>
                              </div>
                              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Contrato Vigente</h4>
                                {contract ? (
                                  <div className="flex justify-between items-center">
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">Sergio Mur y Marilen Sanabria</p>
                                      <p className="text-xs text-slate-500">{contract.startDate} al {contract.endDate}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-black text-brand-600">{contract.currency} {contract.monthlyAmount.toLocaleString()}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-400 italic">Sin contrato activo</p>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button 
                                onClick={() => navigateTo('unidades', 'detail', property.id)}
                                className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md"
                              >
                                Ver Detalle Completo
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        );
      case 'contratos':
        return (
          <div className="space-y-6">
            <SectionHeader title="Contratos" description="Gestión de alquileres y garantías." onAdd={() => setViewMode('new')} />
            <div className="grid grid-cols-1 gap-4">
              {MOCK_CONTRACTS.map(contract => (
                <div key={contract.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
                  <div className="p-4 bg-blue-50 rounded-2xl text-blue-600">
                    <FileText size={32} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-slate-900">Unidad {contract.propertyId} - {contract.destination}</h3>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-xs font-bold uppercase">{contract.status}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-bold">Inquilino</p>
                        <p className="text-sm font-medium text-slate-700">Sergio Mur y Marilen Sanabria</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-bold">Vigencia</p>
                        <p className="text-sm font-medium text-slate-700">{contract.startDate} al {contract.endDate}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-bold">Monto Mensual</p>
                        <p className="text-sm font-bold text-slate-900">{contract.currency} {contract.monthlyAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-bold">Garante</p>
                        <p className="text-sm font-medium text-slate-700">{contract.guarantorName || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => navigateTo('contratos', 'detail', contract.id)} className="flex-1 md:flex-none px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors">Detalles</button>
                    <button className="flex-1 md:flex-none px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'ingresos':
      case 'egresos':
        const isIngresoTab = activeTab === 'ingresos';
        return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{isIngresoTab ? "Ingresos" : "Egresos"}</h1>
                <p className="text-slate-500 mt-1">{isIngresoTab ? 'Registro de cobros y rentas.' : 'Registro de pagos y gastos.'}</p>
              </div>
              <div className="flex gap-3">
                {!isIngresoTab && (
                  <button 
                    onClick={() => setViewMode('ai-process')}
                    className="flex items-center gap-2 bg-brand-50 text-brand-700 border border-brand-100 px-5 py-2.5 rounded-xl font-bold hover:bg-brand-100 transition-colors shadow-sm"
                  >
                    <Sparkles size={20} />
                    Procesar Factura
                  </button>
                )}
                <button 
                  onClick={() => setViewMode('new')}
                  className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  Nuevo Registro
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar por unidad, concepto o monto..." 
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-brand-500 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Este Mes</button>
                  <button className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Exportar</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Concepto</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidad</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprobante</th>
                      <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {MOCK_TRANSACTIONS.filter(t => isIngresoTab ? t.type === 'Ingreso' : t.type === 'Egreso').map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigateTo(activeTab, 'detail', t.id)}>
                        <td className="px-6 py-4 text-sm text-slate-600">{t.date}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{t.concept}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">345 - Av. Callao 1103</td>
                        <td className="px-6 py-4 text-sm text-slate-500 font-mono">{t.receiptNumber || '-'}</td>
                        <td className={`px-6 py-4 text-sm font-bold text-right ${isIngresoTab ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.currency} {t.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'comprobantes':
        return (
          <div className="space-y-6">
            <SectionHeader title="Comprobantes" description="Imputación y seguimiento de facturas." onAdd={() => setViewMode('new')} />
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-4">Filtros</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="comp-filter" className="text-brand-600" defaultChecked />
                      <span className="text-sm text-slate-600">No imputados</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="comp-filter" className="text-brand-600" />
                      <span className="text-sm text-slate-600">Del proveedor</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Proveedor</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Número</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {[1, 2, 3].map((i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigateTo('comprobantes', 'detail', i.toString())}>
                          <td className="px-6 py-4 text-sm font-medium text-slate-900">Diego Ramon Torrez Ortiz</td>
                          <td className="px-6 py-4 text-sm text-slate-500 font-mono">FCA 0004-00000015</td>
                          <td className="px-6 py-4 text-sm text-slate-600">16/01/2026</td>
                          <td className="px-6 py-4 text-sm font-bold text-right text-slate-900">$ 2.904.000,00</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );
      case 'reportes':
        return (
          <div className="space-y-6">
            <SectionHeader title="Reportes" description="Análisis de rentabilidad y flujos de caja." />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6">Ingresos vs Egresos</h3>
                <div className="flex items-end gap-2 h-40">
                  {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                    <div key={i} className="flex-1 bg-brand-100 rounded-t-lg relative group">
                      <div className="absolute bottom-0 w-full bg-brand-500 rounded-t-lg transition-all duration-500" style={{ height: `${h}%` }}></div>
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                        $ {h * 10}k
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Lun</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span><span>Dom</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-slate-900 mb-6">Ocupación por Zona</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Palermo', val: 95, color: 'bg-blue-500' },
                    { label: 'Recoleta', val: 82, color: 'bg-emerald-500' },
                    { label: 'Belgrano', val: 64, color: 'bg-amber-500' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-600">{item.label}</span>
                        <span className="font-bold text-slate-900">{item.val}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className={`${item.color} h-full transition-all duration-1000`} style={{ width: `${item.val}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-600 mb-4">
                  <DollarSign size={32} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">$ 12.4M</h3>
                <p className="text-sm text-slate-500">Rentabilidad Anual Estimada</p>
                <button className="mt-6 w-full py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors">Descargar PDF</button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar Desktop */}
      <aside className={`hidden lg:flex flex-col w-72 bg-white border-r border-slate-100 p-6 fixed h-full transition-all duration-300 z-50`}>
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-slate-900 p-2 rounded-xl cursor-pointer" onClick={() => navigateTo('dashboard')}>
            <Building2 className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 cursor-pointer" onClick={() => navigateTo('dashboard')}>Relik Admin</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
          <SidebarItem icon={Home} label="Unidades" active={activeTab === 'unidades'} onClick={() => navigateTo('unidades')} />
          <SidebarItem icon={FileText} label="Contratos" active={activeTab === 'contratos'} onClick={() => navigateTo('contratos')} />
          <SidebarItem icon={ArrowUpRight} label="Ingresos" active={activeTab === 'ingresos'} onClick={() => navigateTo('ingresos')} />
          <SidebarItem icon={ArrowDownLeft} label="Egresos" active={activeTab === 'egresos'} onClick={() => navigateTo('egresos')} />
          <SidebarItem icon={Receipt} label="Comprobantes" active={activeTab === 'comprobantes'} onClick={() => navigateTo('comprobantes')} />
          <SidebarItem icon={BarChart3} label="Reportes" active={activeTab === 'reportes'} onClick={() => navigateTo('reportes')} />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-50">
          <SidebarItem icon={Settings} label="Configuración" active={activeTab === 'settings'} onClick={() => navigateTo('settings')} />
          <div className="mt-6 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
              NA
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-slate-900 truncate">Nico De Angelis</p>
              <p className="text-xs text-slate-500 truncate">Administrador</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-100 h-16 flex items-center justify-between px-6 z-40">
        <div className="flex items-center gap-2" onClick={() => navigateTo('dashboard')}>
          <Building2 className="text-slate-900" size={24} />
          <span className="font-bold text-slate-900">Relik Admin</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-500">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            onClick={() => setIsSidebarOpen(false)}
          >
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-72 bg-white h-full p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-10 px-2">
                <div className="bg-slate-900 p-2 rounded-xl">
                  <Building2 className="text-white" size={24} />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Relik Admin</h1>
              </div>

              <nav className="space-y-2">
                <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => navigateTo('dashboard')} />
                <SidebarItem icon={Home} label="Unidades" active={activeTab === 'unidades'} onClick={() => navigateTo('unidades')} />
                <SidebarItem icon={FileText} label="Contratos" active={activeTab === 'contratos'} onClick={() => navigateTo('contratos')} />
                <SidebarItem icon={ArrowUpRight} label="Ingresos" active={activeTab === 'ingresos'} onClick={() => navigateTo('ingresos')} />
                <SidebarItem icon={ArrowDownLeft} label="Egresos" active={activeTab === 'egresos'} onClick={() => navigateTo('egresos')} />
                <SidebarItem icon={Receipt} label="Comprobantes" active={activeTab === 'comprobantes'} onClick={() => navigateTo('comprobantes')} />
                <SidebarItem icon={BarChart3} label="Reportes" active={activeTab === 'reportes'} onClick={() => navigateTo('reportes')} />
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 pt-20 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto p-6 lg:p-10">
          <motion.div
            key={`${activeTab}-${viewMode}-${selectedId}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
