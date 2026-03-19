import { ScenePreset } from './types';

export const MODEL_REGIONS = [
    { id: 'east_asia', label: 'Asia Timur (Korea / Jepang)', prompt: 'East Asian facial features, Korean/Japanese aesthetic, fair skin, K-Drama style look' },
    { id: 'se_asia', label: 'Asia Tenggara (Indonesia)', prompt: 'Southeast Asian Indonesian facial features, warm skin tone, authentic Indonesian look' },
    { id: 'south_asia', label: 'Asia Selatan (India)', prompt: 'South Asian Indian facial features, beautiful tanned skin, Bollywood cinematic look' },
    { id: 'middle_east', label: 'Timur Tengah (Arab Saudi)', prompt: 'Middle Eastern Arabian facial features, sharp features, olive skin' },
    { id: 'africa_sub', label: 'Afrika Sub-Sahara (Nigeria)', prompt: 'Sub-Saharan African Nigerian facial features, beautiful dark skin, glowing complexion' },
    { id: 'africa_north', label: 'Afrika Utara (Mesir)', prompt: 'North African Egyptian facial features, golden olive skin' },
    { id: 'west_europe', label: 'Eropa Barat (Inggris)', prompt: 'Western European British facial features, caucasian, fair skin' },
    { id: 'south_europe', label: 'Eropa Selatan (Italia)', prompt: 'Southern European Italian facial features, Mediterranean look' },
    { id: 'latin_america', label: 'Amerika Latin (Brazil / Meksiko)', prompt: 'Latin American facial features, Brazilian/Mexican aesthetic, sun-kissed skin' },
    { id: 'oceania', label: 'Oceania (Australia)', prompt: 'Australian caucasian facial features, outdoorsy look, sun-kissed' },
];

export const CHARACTER_FRAMINGS = [
    { id: 'close_up', label: 'Close Up (Kepala)', prompt: 'Close-up shot focusing primarily on the face, neck, and shoulders. High detail on facial features.' },
    { id: 'half_body', label: 'Half Body (Setengah Badan)', prompt: 'Medium shot, showing the character from the waist up. Captures upper body outfit details and gestures.' },
    { id: 'full_body', label: 'Full Body (Seluruh Badan)', prompt: 'Full body wide shot, showing the character from head to toe, including shoes. The entire outfit must be visible.' },
];

export const VISUAL_GENRES = [
  "Photorealistic",
  "Cinematic",
  "Digital Art",
  "Semi-Realistic",
  "Anime",
  "3D Render",
  "Pixar-Style",
  "Game Character",
  "Illustration",
  "Vaporwave",
  "Synthwave",
  "Cyberpunk",
  "HUD Hologram",
  "Blueprint Style",
  "Oil Painting",
  "Watercolor",
  "Pencil Sketch",
  "Vintage Film",
  "Minimalist",
  "Abstract"
];

export const CAMERA_ANGLES = [
  "Close-up",
  "Medium Shot",
  "Long Shot",
  "Full Body",
  "Low Angle",
  "High Angle",
  "Top View / Drone",
  "Side Angle / Profile",
  "POV (Point of View)",
  "Isometric",
  "Dutch Angle",
  "Wide Angle",
  "Fisheye Lens",
  "Over-the-Shoulder"
];

// ============================================================
// SCENE PRESETS — prompt siap pakai untuk Buat Gambar
// ============================================================
export const SCENE_PRESETS: ScenePreset[] = [
  // ── Islami ──
  {
    id: 'idul_fitri',
    category: 'Islami',
    label: 'Idul Fitri',
    icon: '🕌',
    prompt: 'Model berpakaian muslim elegan berdiri di depan masjid megah dengan ornamen islami, cahaya emas saat golden hour, nuansa festive idul fitri 1447H, dekorasi ketupat dan bulan sabit, warna pastel gold dan hijau toska, atmosfer hangat dan khidmat, cocok untuk kartu ucapan minal aidin wal faizin',
  },
  {
    id: 'idul_adha',
    category: 'Islami',
    label: 'Idul Adha',
    icon: '🐑',
    prompt: 'Model berpakaian muslim elegan berdiri di area outdoor hijau dengan nuansa idul adha, langit biru cerah, busana muslim warna earth tone, nuansa syukur dan kebersamaan, pencahayaan natural siang hari yang cerah dan hangat',
  },
  {
    id: 'ramadan',
    category: 'Islami',
    label: 'Ramadan',
    icon: '🌙',
    prompt: 'Model berpakaian muslim premium duduk elegan dengan nuansa ramadan kareem, lampu lentera emas dan ornamen islami di background, pencahayaan hangat amber, busana muslim warna deep teal atau maroon, suasana malam ramadan yang khidmat dan indah',
  },

  // ── Fashion ──
  {
    id: 'editorial',
    category: 'Fashion',
    label: 'Editorial Outdoor',
    icon: '📸',
    prompt: 'Fashion editorial photography, model berpose percaya diri di distrik urban artistik, pencahayaan natural golden hour, outfit stylish dan contemporary, komposisi sinematik, high fashion magazine style, warna vivid dan kontras tinggi',
  },
  {
    id: 'lookbook',
    category: 'Fashion',
    label: 'Lookbook Studio',
    icon: '✨',
    prompt: 'Lookbook fashion photography, model berpose di studio minimalis dengan backdrop putih bersih, pencahayaan studio profesional soft diffused, outfit on-trend, pose natural dan variatif, clean dan estetik, commercial fashion photography style',
  },
  {
    id: 'streetstyle',
    category: 'Fashion',
    label: 'Street Style',
    icon: '🏙️',
    prompt: 'Street style fashion photography, model berjalan casual di pusat kota dengan outfit OOTD stylish, candid photography feel, bokeh city background, pencahayaan natural siang hari, nuansa young urban dan fresh',
  },
  {
    id: 'muslim_fashion',
    category: 'Fashion',
    label: 'Muslim Fashion',
    icon: '👗',
    prompt: 'Muslim fashion photography, model berpakaian muslim modern dan elegan, outfit islami stylish dan trendy, background aesthetic minimalis atau taman, pencahayaan soft natural, nuansa modest fashion premium',
  },

  // ── Produk ──
  {
    id: 'produk_model',
    category: 'Produk',
    label: 'Model + Produk',
    icon: '🛍️',
    prompt: 'Commercial product photography with model, model menampilkan produk dengan ekspresi natural dan antusias, studio lighting profesional, background clean berfokus pada produk, produk terlihat sangat jelas dan menarik, high quality commercial photography',
  },
  {
    id: 'beauty',
    category: 'Produk',
    label: 'Beauty / Skincare',
    icon: '💄',
    prompt: 'Beauty photography, model close-up dengan kulit glowing sehat bercahaya, produk skincare atau makeup digunakan secara natural, soft diffused studio lighting, nuansa clean dan premium, beauty commercial photography style yang elegan',
  },
  {
    id: 'food_model',
    category: 'Produk',
    label: 'Food & Beverage',
    icon: '☕',
    prompt: 'Food and beverage commercial photography, model memegang atau menyajikan produk makanan/minuman dengan ekspresi menikmati yang tulus, pencahayaan warm dan appetizing, background cafe atau dapur modern yang bersih, nuansa lifestyle dan authentic',
  },

  // ── Profesional ──
  {
    id: 'headshot',
    category: 'Profesional',
    label: 'Headshot Profesional',
    icon: '💼',
    prompt: 'Professional corporate headshot photography, model berpakaian formal atau business casual, ekspresi percaya diri dan ramah, background office blur atau studio netral abu-abu, pencahayaan studio profesional clean, cocok untuk LinkedIn dan company profile',
  },
  {
    id: 'company',
    category: 'Profesional',
    label: 'Company Profile',
    icon: '🏢',
    prompt: 'Corporate company profile photography, model berpakaian profesional di lingkungan kantor modern dengan interior glass dan steel, ekspresi confident dan approachable, pencahayaan natural office, komposisi profesional dan berkelas',
  },

  // ── Event ──
  {
    id: 'wisuda',
    category: 'Event',
    label: 'Wisuda',
    icon: '🎓',
    prompt: 'Graduation photography, model mengenakan toga wisuda dengan ekspresi bangga dan bahagia, memegang ijazah atau topi wisuda dilempar ke udara, background kampus megah atau aula universitas, pencahayaan cerah dan membahagiakan, momen bersejarah yang memorable',
  },
  {
    id: 'prewedding',
    category: 'Event',
    label: 'Pre-Wedding',
    icon: '💍',
    prompt: 'Pre-wedding photography, suasana romantis dan elegan, pencahayaan golden hour yang hangat, nuansa intimate dan bahagia, lokasi yang indah dan estetik seperti taman bunga atau tepi danau, gaya foto yang timeless dan cinematic',
  },
  {
    id: 'ulang_tahun',
    category: 'Event',
    label: 'Ulang Tahun',
    icon: '🎂',
    prompt: 'Birthday photography, model dengan ekspresi bahagia dan ceria, dekorasi birthday yang meriah dan colorful, balon warna-warni dan confetti berterbangan, kue ulang tahun dengan lilin, pencahayaan cerah dan festive, nuansa celebration yang menyenangkan',
  },
];

// Ambil daftar kategori unik dari SCENE_PRESETS
export const SCENE_PRESET_CATEGORIES = [...new Set(SCENE_PRESETS.map(p => p.category))];

// ============================================================
// FRAMING / SHOT TYPE OPTIONS
// ============================================================
export const FRAMING_OPTIONS = [
  {
    id: 'auto',
    label: 'Auto',
    icon: '🎲',
    desc: 'AI pilih sendiri',
    camera: null, // pakai SCENE_SUB_VARIATIONS
  },
  {
    id: 'close_up',
    label: 'Close Up',
    icon: '🔍',
    desc: 'Wajah & bahu',
    camera: 'close-up portrait shot, face and shoulders fill the frame, intimate framing, subject very close to camera',
  },
  {
    id: 'medium',
    label: 'Medium Shot',
    icon: '🧍',
    desc: 'Pinggang ke atas',
    camera: 'medium shot from waist up, subject clearly visible, standard portrait framing, eye-level angle',
  },
  {
    id: 'full_body',
    label: 'Full Body',
    icon: '🧍‍♀️',
    desc: 'Seluruh badan',
    camera: 'full body shot showing subject from head to toe, entire figure visible, slight distance from subject',
  },
  {
    id: 'wide',
    label: 'Wide Shot',
    icon: '🌄',
    desc: 'Model + lingkungan',
    camera: 'wide establishing shot, subject visible within their environment, showing location context clearly',
  },
];
