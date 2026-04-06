'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Briefcase,
  Wallet,
  Users,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Plus,
  Upload,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import PageHeader from '@/components/PageHeader';
import StatsCard from '@/components/StatsCard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { showToast } from '@/components/Toast';
import {
  getBrms,
  updateBrmStatus,
  adjustBrmCommission,
  getBrmCommissionSummary,
  getPendingCashouts,
  approveCashout,
  rejectCashout,
  getMerchantsAwaitingActivation,
  overrideMerchantActivation,
  createBrmAgentFn,
  uploadBrmFile,
  sendBrmWelcomeEmailFn,
  updateBrm,
  deleteBrm,
  getMerchantsByBrm,
} from '@/lib/firestore';
import { Brm, BrmCashout, BrmMerchant } from '@/lib/types';

// ── Nigeria States + LGAs ─────────────────────────────────────────────────────
const NIGERIA_STATE_LGAS: Record<string, string[]> = {
  'Abia': ['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala Ngwa North','Isiala Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma','Ugwunagbo','Ukwa East','Ukwa West','Umuahia North','Umuahia South','Umu Nneochi'],
  'Adamawa': ['Demsa','Fufure','Ganye','Gayuk','Gombi','Guyuk','Hong','Jada','Lamurde','Madagali','Maiha','Mayo-Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South'],
  'Akwa Ibom': ['Abak','Eastern Obolo','Eket','Esit Eket','Essien Udim','Etim Ekpo','Etinan','Ibeno','Ibesikpo Asutan','Ibiono-Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat-Enin','Nsit-Atai','Nsit-Ibom','Nsit-Ubium','Obot Akara','Okobo','Onna','Oron','Oruk Anam','Udung-Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo'],
  'Anambra': ['Aguata','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi'],
  'Bauchi': ['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau','Jama\'are','Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki'],
  'Bayelsa': ['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa'],
  'Benue': ['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya'],
  'Borno': ['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani'],
  'Cross River': ['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakuur','Yala'],
  'Delta': ['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West'],
  'Ebonyi': ['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha'],
  'Edo': ['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba Okha','Orhionmwon','Owan East','Owan West','Uhunmwonde','Ovia North-East','Ovia South-West','Oredo'],
  'Ekiti': ['Ado Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye'],
  'Enugu': ['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo Etiti','Igbo Eze North','Igbo Eze South','Isi Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo Uwani'],
  'FCT': ['Abaji','Bwari','Gwagwalada','Kuje','Kwali','Municipal Area Council'],
  'Gombe': ['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba'],
  'Imo': ['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Onuimo','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West'],
  'Jigawa': ['Auyo','Babura','Biriniwa','Birnin Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule-Tankarkar','Taura','Yankwashi'],
  'Kaduna': ['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba','Jema\'a','Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria'],
  'Kano': ['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nasarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil'],
  'Katsina': ['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dandume','Danja','Dan Musa','Daura','Dutsi','Dutsin-Ma','Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada','Mai\'Adua','Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango'],
  'Kebbi': ['Aleiro','Arewa','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru'],
  'Kogi': ['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela-Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa-Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West'],
  'Kwara': ['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Pategi'],
  'Lagos': ['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti-Osa','Ibeju-Lekki','Ifako-Ijaye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere'],
  'Nasarawa': ['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Eggon','Obi','Toto','Wamba'],
  'Niger': ['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Moya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi'],
  'Ogun': ['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko-Afon','Ipokia','Obafemi-Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Sagamu','Yewa North','Yewa South'],
  'Ondo': ['Akoko North-East','Akoko North-West','Akoko South-East','Akoko South-West','Akure North','Akure South','Ese Odo','Idanre','Ifedore','Ilaje','Ile Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo'],
  'Osun': ['Aiyedaade','Aiyedire','Atakumosa East','Atakumosa West','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ife Central','Ife East','Ife North','Ife South','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo-Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo'],
  'Oyo': ['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomosho North','Ogbomosho South','Ogo Oluwa','Olorunsogo','Oluyole','Ona Ara','Orelope','Orire','Oyo East','Oyo West','Saki East','Saki West','Surulere'],
  'Plateau': ['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin','Qua\'an Pan','Riyom','Shendam','Wase'],
  'Rivers': ['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Eleme','Emuoha','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai'],
  'Sokoto': ['Binji','Bodinga','Dange Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kware','Kebbe','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo'],
  'Taraba': ['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kumi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing'],
  'Yobe': ['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari'],
  'Zamfara': ['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Tsafe','Wurno'],
};
const NIGERIA_STATES = Object.keys(NIGERIA_STATE_LGAS).sort();

// ── Profile field helper ─────────────────────────────────────────────────────
function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value || '—'}</p>
    </div>
  );
}

// ── Searchable Select ────────────────────────────────────────────────────────
function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-left flex items-center justify-between text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={value ? '' : 'text-gray-400'}>{value || placeholder}</span>
        <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No results</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); setQuery(''); }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 ${
                    opt === value
                      ? 'bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-600 dark:text-blue-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {opt}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

type Tab = 'agents' | 'cashouts' | 'activations';

function formatNaira(amount: number) {
  return '₦' + amount.toLocaleString('en-NG', { minimumFractionDigits: 0 });
}

function formatDate(date?: Date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function BrmAgentsPage() {
  const { admin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('agents');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Agents
  const [brms, setBrms] = useState<Brm[]>([]);
  const [search, setSearch] = useState('');
  const [expandedBrm, setExpandedBrm] = useState<string | null>(null);
  const [brmSummaries, setBrmSummaries] = useState<
    Record<string, { totalEarned: number; available: number; pending: number }>
  >({});
  const [brmMerchants, setBrmMerchants] = useState<Record<string, BrmMerchant[]>>({});

  // Adjust modal
  const [adjustTarget, setAdjustTarget] = useState<Brm | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Suspend/reactivate confirm
  const [statusTarget, setStatusTarget] = useState<Brm | null>(null);

  // Cashouts
  const [cashouts, setCashouts] = useState<BrmCashout[]>([]);
  const [rejectTarget, setRejectTarget] = useState<BrmCashout | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveTarget, setApproveTarget] = useState<BrmCashout | null>(null);

  // Merchant activations
  const [merchants, setMerchants] = useState<BrmMerchant[]>([]);
  const [overrideTarget, setOverrideTarget] = useState<BrmMerchant | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Profile view
  const [profileTarget, setProfileTarget] = useState<Brm | null>(null);

  // Edit profile
  const [editTarget, setEditTarget] = useState<Brm | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    nin: '',
    dateOfBirth: '',
    address: '',
    state: '',
    lga: '',
  });

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Brm | null>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // ── Create BRM modal ───────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    nin: '',
    dateOfBirth: '',
    address: '',
    state: '',
    lga: '',
  });
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState<string | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [brmData, cashoutData, merchantData] = await Promise.all([
        getBrms(),
        getPendingCashouts(),
        getMerchantsAwaitingActivation(),
      ]);
      setBrms(brmData);
      setCashouts(cashoutData);
      setMerchants(merchantData);
    } catch (err) {
      console.error('Failed to load BRM data:', err);
      showToast('error', 'Load failed', 'Could not load BRM data');
    } finally {
      setLoading(false);
    }
  }

  async function loadBrmSummary(brmId: string) {
    if (brmSummaries[brmId]) return;
    try {
      const s = await getBrmCommissionSummary(brmId);
      setBrmSummaries((prev) => ({ ...prev, [brmId]: s }));
    } catch {
      // non-critical
    }
  }

  async function loadBrmMerchants(brmId: string) {
    if (brmMerchants[brmId]) return;
    try {
      const m = await getMerchantsByBrm(brmId);
      setBrmMerchants((prev) => ({ ...prev, [brmId]: m }));
    } catch {
      // non-critical
    }
  }

  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loading />
      </div>
    );
  }

  if (!admin) {
    router.refresh();
    return null;
  }

  if (admin.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 text-gray-700">
        <div className="text-center space-y-2">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-lg font-semibold">Access denied</p>
          <p className="text-sm text-gray-500">Only admins can manage BRM agents.</p>
        </div>
      </div>
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleToggleStatus() {
    if (!statusTarget) return;
    setActionLoading(true);
    try {
      const next = statusTarget.status === 'active' ? 'suspended' : 'active';
      await updateBrmStatus(statusTarget.id, next);
      setBrms((prev) =>
        prev.map((b) => (b.id === statusTarget.id ? { ...b, status: next } : b))
      );
      showToast('success', 'Done', `BRM ${next === 'active' ? 'reactivated' : 'suspended'}`);
    } catch {
      showToast('error', 'Failed', 'Could not update BRM status');
    } finally {
      setActionLoading(false);
      setStatusTarget(null);
    }
  }

  async function handleAdjustCommission() {
    if (!adjustTarget || !adjustAmount || !adjustReason.trim() || !admin) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      showToast('warning', 'Invalid amount', 'Enter a non-zero number');
      return;
    }
    setActionLoading(true);
    try {
      await adjustBrmCommission(adjustTarget.id, amount, adjustReason.trim(), admin.id);
      showToast('success', 'Adjusted', `${formatNaira(Math.abs(amount))} ${amount >= 0 ? 'credited' : 'debited'}`);
      // Refresh summary for this BRM
      setBrmSummaries((prev) => {
        const existing = prev[adjustTarget.id];
        if (!existing) return prev;
        const earned = amount > 0 ? existing.totalEarned + amount : existing.totalEarned;
        const available = existing.available + amount;
        return { ...prev, [adjustTarget.id]: { ...existing, totalEarned: earned, available } };
      });
    } catch {
      showToast('error', 'Failed', 'Could not adjust commission');
    } finally {
      setActionLoading(false);
      setAdjustTarget(null);
      setAdjustAmount('');
      setAdjustReason('');
    }
  }

  async function handleApproveCashout() {
    if (!approveTarget || !admin) return;
    setActionLoading(true);
    try {
      await approveCashout(approveTarget.id, admin.id);
      setCashouts((prev) => prev.filter((c) => c.id !== approveTarget.id));
      showToast('success', 'Approved', 'Cashout moved to processing');
    } catch {
      showToast('error', 'Failed', 'Could not approve cashout');
    } finally {
      setActionLoading(false);
      setApproveTarget(null);
    }
  }

  async function handleRejectCashout() {
    if (!rejectTarget || !rejectReason.trim() || !admin) return;
    setActionLoading(true);
    try {
      await rejectCashout(rejectTarget.id, admin.id, rejectReason.trim());
      setCashouts((prev) => prev.filter((c) => c.id !== rejectTarget.id));
      showToast('success', 'Rejected', 'Cashout rejected');
    } catch {
      showToast('error', 'Failed', 'Could not reject cashout');
    } finally {
      setActionLoading(false);
      setRejectTarget(null);
      setRejectReason('');
    }
  }

  async function handleEditBrm(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditLoading(true);
    try {
      await updateBrm(editTarget.id, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim(),
        nin: editForm.nin.trim(),
        dateOfBirth: editForm.dateOfBirth,
        address: editForm.address.trim(),
        state: editForm.state,
        lga: editForm.lga,
      });
      const fullName = `${editForm.firstName.trim()} ${editForm.lastName.trim()}`;
      setBrms((prev) =>
        prev.map((b) =>
          b.id === editTarget.id
            ? {
                ...b,
                first_name: editForm.firstName.trim(),
                last_name: editForm.lastName.trim(),
                full_name: fullName,
                phone: editForm.phone.trim(),
                nin: editForm.nin.trim(),
                date_of_birth: editForm.dateOfBirth,
                address: editForm.address.trim(),
                state: editForm.state,
                lga: editForm.lga,
              }
            : b
        )
      );
      showToast('success', 'Updated', 'BRM profile saved');
      setEditTarget(null);
    } catch (err) {
      console.error('Failed to update BRM:', err);
      showToast('error', 'Failed', 'Could not update BRM profile');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteBrm() {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteBrm(deleteTarget.id);
      setBrms((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      showToast('success', 'Deleted', `${deleteTarget.full_name} removed`);
    } catch (err) {
      console.error('Failed to delete BRM:', err);
      showToast('error', 'Failed', 'Could not delete BRM agent');
    } finally {
      setActionLoading(false);
      setDeleteTarget(null);
    }
  }

  async function handleOverrideActivation() {
    if (!overrideTarget || !overrideReason.trim() || !admin) return;
    setActionLoading(true);
    try {
      await overrideMerchantActivation(
        overrideTarget.id,
        overrideTarget.referring_brm_id,
        admin.id,
        overrideReason.trim(),
      );
      setMerchants((prev) => prev.filter((m) => m.id !== overrideTarget.id));
      showToast('success', 'Activated', 'Merchant activated & ₦5,000 bonus credited');
    } catch {
      showToast('error', 'Failed', 'Could not override activation');
    } finally {
      setActionLoading(false);
      setOverrideTarget(null);
      setOverrideReason('');
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const filteredBrms = brms.filter((b) => {
    const q = search.toLowerCase();
    return (
      b.full_name?.toLowerCase().includes(q) ||
      b.email?.toLowerCase().includes(q) ||
      b.phone?.includes(q) ||
      b.referral_code?.toLowerCase().includes(q)
    );
  });

  const totalActive = brms.filter((b) => b.status === 'active').length;
  const totalSuspended = brms.filter((b) => b.status === 'suspended').length;

  // ── Create BRM handler ────────────────────────────────────────────────────
  function setField(key: keyof typeof createForm, value: string) {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }

  function pickFile(
    file: File | null,
    setter: (f: File | null) => void,
    previewSetter: (url: string | null) => void,
  ) {
    setter(file);
    if (file) {
      const url = URL.createObjectURL(file);
      previewSetter(url);
    } else {
      previewSetter(null);
    }
  }

  function resetCreateForm() {
    setCreateForm({ firstName: '', lastName: '', email: '', password: '',
      phone: '', nin: '', dateOfBirth: '', address: '', state: '', lga: '' });
    setProfilePhotoFile(null);
    setIdPhotoFile(null);
    setProfilePhotoPreview(null);
    setIdPhotoPreview(null);
    setShowCreatePassword(false);
  }

  async function handleCreateBrm(e: React.FormEvent) {
    e.preventDefault();
    const { firstName, lastName, email, password, phone, nin, dateOfBirth, address, state, lga } = createForm;
    const missing: string[] = [];
    if (!firstName.trim()) missing.push('First name');
    if (!lastName.trim()) missing.push('Last name');
    if (!email.trim()) missing.push('Email');
    if (!password) missing.push('Password');
    if (!phone.trim()) missing.push('Phone');
    if (!nin.trim()) missing.push('NIN');
    if (!dateOfBirth) missing.push('Date of birth');
    if (!address.trim()) missing.push('Address');
    if (!state) missing.push('State');
    if (!lga) missing.push('LGA');
    if (!profilePhotoFile) missing.push('Agent photo');
    if (!idPhotoFile) missing.push('ID document photo');
    if (missing.length > 0) {
      showToast('warning', 'Missing fields', missing.join(', '));
      return;
    }
    if (password.length < 8) {
      showToast('warning', 'Weak password', 'Password must be at least 8 characters');
      return;
    }
    setCreateLoading(true);
    try {
      // Step 1: create Auth user + Firestore doc via Cloud Function
      const { uid, referralCode } = await createBrmAgentFn({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
        nin: createForm.nin.trim(),
        dateOfBirth: createForm.dateOfBirth,
        address: createForm.address.trim(),
        state: createForm.state,
        lga: createForm.lga,
      });

      // Step 2: upload photos if provided
      let profilePhotoUrl: string | undefined;
      let idPhotoUrl: string | undefined;

      if (profilePhotoFile) {
        try {
          profilePhotoUrl = await uploadBrmFile(profilePhotoFile, uid, 'profile_photo');
        } catch {
          showToast('warning', 'Photo upload failed', 'Agent created but profile photo could not be saved');
        }
      }
      if (idPhotoFile) {
        try {
          idPhotoUrl = await uploadBrmFile(idPhotoFile, uid, 'id_photo');
        } catch {
          showToast('warning', 'Photo upload failed', 'Agent created but ID photo could not be saved');
        }
      }

      // Step 3: patch the Firestore doc with photo URLs if we have them
      if (profilePhotoUrl || idPhotoUrl) {
        const { doc: fsDoc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const updates: Record<string, string> = {};
        if (profilePhotoUrl) updates.profile_photo_url = profilePhotoUrl;
        if (idPhotoUrl) updates.id_photo_url = idPhotoUrl;
        await updateDoc(fsDoc(db, 'brms', uid), updates);
      }

      // Step 4: add to local list
      const newBrm: Brm = {
        id: uid,
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        phone: phone.trim(),
        nin: createForm.nin.trim(),
        date_of_birth: createForm.dateOfBirth,
        address: createForm.address.trim(),
        state: createForm.state,
        lga: createForm.lga,
        referral_code: referralCode,
        status: 'active',
        profile_photo_url: profilePhotoUrl ?? null,
      } as unknown as Brm;
      setBrms((prev) => [newBrm, ...prev]);

      void sendBrmWelcomeEmailFn({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
        referralCode,
        loginUrl: 'https://padipay.co/brm/login',
      }).catch((mailError) => {
        console.warn('BRM welcome email failed:', mailError);
      });

      showToast('success', 'BRM Agent Created', `${firstName} ${lastName} can now log in. Referral code: ${referralCode}`);
      setShowCreate(false);
      resetCreateForm();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Could not create BRM agent';
      showToast('error', 'Creation failed', msg);
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="BRM Agents"
        description="Manage Business Relationship Managers — commissions, cashouts, and merchant activations"
        action={{
          label: 'Create BRM Agent',
          onClick: () => setShowCreate(true),
          icon: <Plus className="w-4 h-4" />,
        }}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total BRMs" value={brms.length} icon={<Briefcase className="w-5 h-5" />} />
        <StatsCard title="Active BRMs" value={totalActive} icon={<Users className="w-5 h-5" />} />
        <StatsCard title="Suspended" value={totalSuspended} icon={<XCircle className="w-5 h-5" />} />
        <StatsCard title="Pending Cashouts" value={cashouts.length} icon={<Wallet className="w-5 h-5" />} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          {(
            [
              { id: 'agents', label: 'BRM List', count: brms.length },
              { id: 'cashouts', label: 'Cashout Requests', count: cashouts.length },
              { id: 'activations', label: 'Merchant Activations', count: merchants.length },
            ] as { id: Tab; label: string; count: number }[]
          ).map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                {count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loading />
        </div>
      ) : (
        <>
          {/* ── TAB: Agents ── */}
          {tab === 'agents' && (
            <div className="card space-y-4">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {filteredBrms.length === 0 ? (
                <p className="text-center py-12 text-gray-400 text-sm">No BRM agents found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Phone</th>
                        <th className="pb-3 font-medium hidden md:table-cell">State</th>
                        <th className="pb-3 font-medium hidden lg:table-cell">Referral Code</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {filteredBrms.map((brm) => {
                        const isExpanded = expandedBrm === brm.id;
                        const summary = brmSummaries[brm.id];
                        return (
                          <>
                            <tr key={brm.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setExpandedBrm(isExpanded ? null : brm.id);
                                      if (!isExpanded) { loadBrmSummary(brm.id); loadBrmMerchants(brm.id); }
                                    }}
                                    className="cursor-pointer text-gray-400 hover:text-gray-600"
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">
                                      {brm.full_name}
                                    </p>
                                    <p className="text-xs text-gray-400">{brm.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                                {brm.phone}
                              </td>
                              <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 hidden md:table-cell">
                                {brm.state || '—'}
                              </td>
                              <td className="py-3 pr-4 font-mono text-xs text-gray-500 hidden lg:table-cell">
                                {brm.referral_code}
                              </td>
                              <td className="py-3 pr-4">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    brm.status === 'active'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                      : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                  }`}
                                >
                                  {brm.status}
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => { setProfileTarget(brm); loadBrmSummary(brm.id); loadBrmMerchants(brm.id); }}
                                    title="View profile"
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 dark:border-gray-700 dark:hover:border-blue-700 transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditTarget(brm);
                                      setEditForm({
                                        firstName: brm.first_name ?? brm.full_name.split(' ')[0] ?? '',
                                        lastName: brm.last_name ?? brm.full_name.split(' ').slice(1).join(' ') ?? '',
                                        phone: brm.phone ?? '',
                                        nin: brm.nin ?? '',
                                        dateOfBirth: brm.date_of_birth ?? '',
                                        address: brm.address ?? '',
                                        state: brm.state ?? '',
                                        lga: brm.lga ?? '',
                                      });
                                    }}
                                    title="Edit"
                                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-200 dark:border-gray-700 dark:hover:border-blue-700 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAdjustTarget(brm);
                                      loadBrmSummary(brm.id);
                                    }}
                                    className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                                  >
                                    Adjust Balance
                                  </button>
                                  <button
                                    onClick={() => setStatusTarget(brm)}
                                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                      brm.status === 'active'
                                        ? 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/30'
                                        : 'border-green-200 text-green-600 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/30'
                                    }`}
                                  >
                                    {brm.status === 'active' ? 'Suspend' : 'Reactivate'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${brm.id}-expanded`} className="bg-gray-50 dark:bg-gray-800/30">
                                <td colSpan={6} className="px-8 py-4">
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-400 text-xs mb-1">Total Earned</p>
                                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                                        {summary ? formatNaira(summary.totalEarned) : '…'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-xs mb-1">Available</p>
                                      <p className="font-semibold text-green-600">
                                        {summary ? formatNaira(summary.available) : '…'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-xs mb-1">Pending</p>
                                      <p className="font-semibold text-orange-500">
                                        {summary ? formatNaira(summary.pending) : '…'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-xs mb-1">Member Since</p>
                                      <p className="font-semibold text-gray-700 dark:text-gray-300">
                                        {formatDate(brm.created_at)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-xs mb-1">Merchants Referred</p>
                                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                                        {brmMerchants[brm.id] ? brmMerchants[brm.id].length : '…'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-gray-400 text-xs mb-1">Activated</p>
                                      <p className="font-semibold text-blue-600">
                                        {brmMerchants[brm.id]
                                          ? brmMerchants[brm.id].filter((m) => m.activation_status === 'activated').length
                                          : '…'}
                                      </p>
                                    </div>
                                    {brm.bank_name && (
                                      <div className="col-span-2 md:col-span-4">
                                        <p className="text-gray-400 text-xs mb-1">Bank Account</p>
                                        <p className="text-gray-700 dark:text-gray-300">
                                          {brm.bank_account_name} · {brm.bank_name} ···{' '}
                                          {brm.bank_account_number?.slice(-4)}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Cashouts ── */}
          {tab === 'cashouts' && (
            <div className="card">
              {cashouts.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No pending cashout requests</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="pb-3 font-medium">BRM</th>
                        <th className="pb-3 font-medium">Amount</th>
                        <th className="pb-3 font-medium hidden md:table-cell">Bank</th>
                        <th className="pb-3 font-medium hidden md:table-cell">Account</th>
                        <th className="pb-3 font-medium hidden lg:table-cell">Requested</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {cashouts.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {c.brm_name ?? c.brm_id}
                            </p>
                          </td>
                          <td className="py-3 pr-4 font-semibold text-gray-900 dark:text-gray-100">
                            {formatNaira(c.amount)}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 hidden md:table-cell">
                            {c.bank_name}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 hidden md:table-cell">
                            {c.bank_account_name} · ···{c.bank_account_number?.slice(-4)}
                          </td>
                          <td className="py-3 pr-4 text-gray-400 hidden lg:table-cell">
                            {formatDate(c.requested_at)}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setApproveTarget(c)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/30 transition-colors cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectTarget(c)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Activations ── */}
          {tab === 'activations' && (
            <div className="card">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Merchants whose KYC is approved but haven&apos;t reached 10 transactions yet. Override to manually activate and credit the BRM&apos;s ₦5,000 bonus.
              </p>
              {merchants.length === 0 ? (
                <div className="text-center py-16">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No merchants awaiting activation</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                        <th className="pb-3 font-medium">Merchant</th>
                        <th className="pb-3 font-medium hidden md:table-cell">Phone</th>
                        <th className="pb-3 font-medium">Transactions</th>
                        <th className="pb-3 font-medium hidden lg:table-cell">Joined</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {merchants.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {m.business_name}
                            </p>
                            {m.owner_name && (
                              <p className="text-xs text-gray-400">{m.owner_name}</p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-300 hidden md:table-cell">
                            {m.phone ?? '—'}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      ((m.activation_transaction_count ?? 0) / 10) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">
                                {m.activation_transaction_count ?? 0} / 10
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-gray-400 hidden lg:table-cell">
                            {formatDate(m.created_at)}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setOverrideTarget(m)}
                              className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                            >
                              Activate Override
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── MODALS ── */}

      {/* Suspend / Reactivate */}
      <ConfirmModal
        isOpen={!!statusTarget}
        type={statusTarget?.status === 'active' ? 'danger' : 'warning'}
        title={statusTarget?.status === 'active' ? 'Suspend BRM' : 'Reactivate BRM'}
        message={
          statusTarget?.status === 'active'
            ? `Suspend ${statusTarget?.full_name}? They will lose access to the BRM portal immediately.`
            : `Reactivate ${statusTarget?.full_name}? They will regain access to the BRM portal.`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Suspend' : 'Reactivate'}
        onConfirm={handleToggleStatus}
        onCancel={() => setStatusTarget(null)}
        isLoading={actionLoading}
      />

      {/* Approve cashout */}
      <ConfirmModal
        isOpen={!!approveTarget}
        type="confirm"
        title="Approve Cashout"
        message={`Approve ${approveTarget ? formatNaira(approveTarget.amount) : ''} to ${approveTarget?.bank_account_name} (${approveTarget?.bank_name})? Status will move to Processing.`}
        confirmLabel="Approve"
        onConfirm={handleApproveCashout}
        onCancel={() => setApproveTarget(null)}
        isLoading={actionLoading}
      />

      {/* Adjust commission modal */}
      {adjustTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setAdjustTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Adjust Commission Balance
                  </h2>
                  <p className="text-xs text-gray-400">{adjustTarget.full_name}</p>
                </div>
              </div>

              {brmSummaries[adjustTarget.id] && (
                <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-400">Available</p>
                    <p className="font-semibold text-green-600">
                      {formatNaira(brmSummaries[adjustTarget.id].available)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Pending</p>
                    <p className="font-semibold text-orange-500">
                      {formatNaira(brmSummaries[adjustTarget.id].pending)}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount (₦)
                  </label>
                  <p className="text-xs text-gray-400 mb-1.5">Use a negative number to debit.</p>
                  <input
                    type="number"
                    step="0.01"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    placeholder="e.g. 5000 or -2000"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Reason for adjustment (logged in audit trail)"
                    rows={3}
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => { setAdjustTarget(null); setAdjustAmount(''); setAdjustReason(''); }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjustCommission}
                  disabled={actionLoading || !adjustAmount || !adjustReason.trim()}
                  className="btn-primary text-sm disabled:opacity-60"
                >
                  {actionLoading ? 'Saving…' : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reject cashout modal */}
      {rejectTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setRejectTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-5">
                <XCircle className="w-8 h-8 text-red-500" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Reject Cashout
                  </h2>
                  <p className="text-xs text-gray-400">
                    {formatNaira(rejectTarget.amount)} · {rejectTarget.brm_name ?? rejectTarget.brm_id}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rejection reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this cashout is being rejected"
                  rows={3}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="btn-secondary text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleRejectCashout}
                  disabled={actionLoading || !rejectReason.trim()}
                  className="text-sm px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {actionLoading ? 'Rejecting…' : 'Reject Cashout'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Override activation modal */}
      {overrideTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOverrideTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Override Merchant Activation
                  </h2>
                  <p className="text-xs text-gray-400">{overrideTarget.business_name}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                This will mark the merchant as <strong>activated</strong> and credit{' '}
                <strong>₦5,000</strong> referral bonus to the referring BRM immediately.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Reason for manual activation (logged in audit trail)"
                  rows={3}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => { setOverrideTarget(null); setOverrideReason(''); }} className="btn-secondary text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleOverrideActivation}
                  disabled={actionLoading || !overrideReason.trim()}
                  className="text-sm px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {actionLoading ? 'Activating…' : 'Activate & Credit Bonus'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── DELETE BRM CONFIRM ── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        type="danger"
        title="Delete BRM Agent"
        message={`Permanently delete ${deleteTarget?.full_name}? Their Firestore profile will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteBrm}
        onCancel={() => setDeleteTarget(null)}
        isLoading={actionLoading}
      />

      {/* ── PROFILE VIEW MODAL ── */}
      {profileTarget && (() => {
        const summary = brmSummaries[profileTarget.id];
        return (
          <>
            <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setProfileTarget(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-xl border border-gray-200 dark:border-gray-700 my-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">BRM Profile</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setProfileTarget(null);
                        setEditTarget(profileTarget);
                        setEditForm({
                          firstName: profileTarget.first_name ?? profileTarget.full_name.split(' ')[0] ?? '',
                          lastName: profileTarget.last_name ?? profileTarget.full_name.split(' ').slice(1).join(' ') ?? '',
                          phone: profileTarget.phone ?? '',
                          nin: profileTarget.nin ?? '',
                          dateOfBirth: profileTarget.date_of_birth ?? '',
                          address: profileTarget.address ?? '',
                          state: profileTarget.state ?? '',
                          lga: profileTarget.lga ?? '',
                        });
                      }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => { setProfileTarget(null); setDeleteTarget(profileTarget); }}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                    <button onClick={() => setProfileTarget(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                  {/* Photos */}
                  {(profileTarget.profile_photo_url || profileTarget.id_photo_url) && (
                    <div className="flex gap-4">
                      {profileTarget.profile_photo_url && (
                        <div className="text-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profileTarget.profile_photo_url}
                            alt="Profile"
                            onClick={() => setLightboxSrc(profileTarget.profile_photo_url!)}
                            className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700 cursor-zoom-in hover:opacity-90 transition-opacity"
                          />
                          <p className="text-xs text-gray-400 mt-1">Agent Photo</p>
                        </div>
                      )}
                      {profileTarget.id_photo_url && (
                        <div className="text-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={profileTarget.id_photo_url}
                            alt="ID"
                            onClick={() => setLightboxSrc(profileTarget.id_photo_url!)}
                            className="w-20 h-20 rounded object-cover border-2 border-gray-200 dark:border-gray-700 cursor-zoom-in hover:opacity-90 transition-opacity"
                          />
                          <p className="text-xs text-gray-400 mt-1">ID Document</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status + Referral Code */}
                  <div className="flex flex-wrap gap-3">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                      profileTarget.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    }`}>{profileTarget.status}</span>
                    <span className="inline-flex items-center px-3 py-1 text-xs font-mono rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {profileTarget.referral_code}
                    </span>
                  </div>

                  {/* Personal details */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <ProfileField label="Full Name" value={profileTarget.full_name} />
                    <ProfileField label="Email" value={profileTarget.email} />
                    <ProfileField label="Phone" value={profileTarget.phone} />
                    <ProfileField label="NIN" value={profileTarget.nin} />
                    <ProfileField label="Date of Birth" value={profileTarget.date_of_birth} />
                    <ProfileField label="State" value={profileTarget.state} />
                    <ProfileField label="LGA" value={profileTarget.lga} />
                    <ProfileField label="Member Since" value={formatDate(profileTarget.created_at)} />
                  </div>
                  {profileTarget.address && (
                    <ProfileField label="Address" value={profileTarget.address} />
                  )}

                  {/* Bank details */}
                  {profileTarget.bank_name && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-1">
                      <p className="text-xs text-gray-400 font-medium mb-1">Bank Account</p>
                      <p className="text-gray-900 dark:text-gray-100">{profileTarget.bank_account_name}</p>
                      <p className="text-gray-500">{profileTarget.bank_name} · {profileTarget.bank_account_number}</p>
                    </div>
                  )}

                  {/* Commission summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Total Earned</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{summary ? formatNaira(summary.totalEarned) : '…'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Available</p>
                      <p className="font-semibold text-green-600 text-sm">{summary ? formatNaira(summary.available) : '…'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                      <p className="text-xs text-gray-400 mb-0.5">Pending</p>
                      <p className="font-semibold text-orange-500 text-sm">{summary ? formatNaira(summary.pending) : '…'}</p>
                    </div>
                  </div>

                  {/* Referred Merchants */}
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">
                      Referred Merchants ({brmMerchants[profileTarget.id]?.length ?? '…'})
                    </p>
                    {!brmMerchants[profileTarget.id] ? (
                      <p className="text-sm text-gray-400">Loading…</p>
                    ) : brmMerchants[profileTarget.id].length === 0 ? (
                      <p className="text-sm text-gray-400">No merchants referred yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {brmMerchants[profileTarget.id].map((m) => {
                          const statusColors: Record<string, string> = {
                            signed_up: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                            kyc_pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
                            kyc_approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
                            activated: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
                            churned: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
                          };
                          const statusLabel: Record<string, string> = {
                            signed_up: 'Signed Up',
                            kyc_pending: 'KYC Pending',
                            kyc_approved: 'KYC Approved',
                            activated: 'Activated',
                            churned: 'Churned',
                          };
                          return (
                            <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{m.business_name}</p>
                                {m.owner_name && <p className="text-xs text-gray-400">{m.owner_name} · {m.phone ?? ''}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[m.activation_status] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {statusLabel[m.activation_status] ?? m.activation_status}
                                </span>
                                {m.activation_status !== 'activated' && (
                                  <span className="text-xs text-gray-400">{m.activation_transaction_count ?? 0}/10 txns</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── EDIT BRM MODAL ── */}
      {editTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setEditTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={handleEditBrm}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 my-4"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Edit BRM Profile</h2>
                  <p className="text-xs text-gray-400">{editTarget.full_name} · {editTarget.email}</p>
                </div>
                <button type="button" onClick={() => setEditTarget(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
                    <input type="text" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
                    <input type="text" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                    <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIN</label>
                    <input type="text" maxLength={11} value={editForm.nin} onChange={(e) => setEditForm((f) => ({ ...f, nin: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date of Birth</label>
                  <input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <input type="text" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <SearchableSelect options={NIGERIA_STATES} value={editForm.state} onChange={(val) => setEditForm((f) => ({ ...f, state: val, lga: '' }))} placeholder="Select state…" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">LGA</label>
                    <SearchableSelect options={NIGERIA_STATE_LGAS[editForm.state] ?? []} value={editForm.lga} onChange={(val) => setEditForm((f) => ({ ...f, lga: val }))} placeholder={editForm.state ? 'Select LGA…' : 'Select state first'} disabled={!editForm.state} />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Email and referral code cannot be changed.</p>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setEditTarget(null)} className="btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={editLoading} className="btn-primary text-sm disabled:opacity-60 flex items-center gap-2">
                  {editLoading ? <><span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ── LIGHTBOX ── */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white cursor-pointer"
          >
            <X className="w-7 h-7" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Full size"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-lg shadow-2xl object-contain cursor-default"
          />
        </div>
      )}

      {/* ── CREATE BRM AGENT MODAL ────────────────────────────────────────── */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShowCreate(false); resetCreateForm(); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <form
              onSubmit={handleCreateBrm}
              className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 my-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Create BRM Agent</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Agent will receive a unique referral code and can log in immediately</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); resetCreateForm(); }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.firstName}
                      onChange={(e) => setField('firstName', e.target.value)}
                      placeholder="Emeka"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.lastName}
                      onChange={(e) => setField('lastName', e.target.value)}
                      placeholder="Okafor"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Email + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setField('email', e.target.value)}
                      placeholder="emeka@example.com"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={createForm.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                      placeholder="08012345678"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      value={createForm.password}
                      onChange={(e) => setField('password', e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* NIN + DOB */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      NIN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={createForm.nin}
                      onChange={(e) => setField('nin', e.target.value)}
                      placeholder="12345678901"
                      maxLength={11}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date of Birth <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={createForm.dateOfBirth}
                      onChange={(e) => setField('dateOfBirth', e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.address}
                    onChange={(e) => setField('address', e.target.value)}
                    placeholder="12 Adeola Street, Lagos"
                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* State + LGA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={NIGERIA_STATES}
                      value={createForm.state}
                      onChange={(val) => { setField('state', val); setField('lga', ''); }}
                      placeholder="Select state…"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      LGA <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={NIGERIA_STATE_LGAS[createForm.state] ?? []}
                      value={createForm.lga}
                      onChange={(val) => setField('lga', val)}
                      placeholder={createForm.state ? 'Select LGA…' : 'Select state first'}
                      disabled={!createForm.state}
                    />
                  </div>
                </div>

                {/* Photo uploads */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Agent photo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Agent Photo <span className="text-red-500">*</span>
                    </label>
                    <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 transition-colors overflow-hidden">
                      {profilePhotoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profilePhotoPreview} alt="Agent preview" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <Upload className="w-6 h-6 mb-1" />
                          <span className="text-xs">Click to upload</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => pickFile(e.target.files?.[0] ?? null, setProfilePhotoFile, setProfilePhotoPreview)}
                      />
                    </label>
                  </div>

                  {/* ID photo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ID Document Photo <span className="text-red-500">*</span>
                    </label>
                    <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 transition-colors overflow-hidden">
                      {idPhotoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={idPhotoPreview} alt="ID preview" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <Upload className="w-6 h-6 mb-1" />
                          <span className="text-xs">Click to upload</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => pickFile(e.target.files?.[0] ?? null, setIdPhotoFile, setIdPhotoPreview)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); resetCreateForm(); }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="btn-primary text-sm disabled:opacity-60 flex items-center gap-2"
                >
                  {createLoading ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Agent
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
