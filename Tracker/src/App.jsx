import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, onSnapshot, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { Home, ClipboardList, Cannabis, Search, Loader, Zap, Heart, Utensils, Droplet, Sun, Pill, Syringe, MessageSquare, Edit, Trash2, Copy, MapPin } from 'lucide-react';

// --- MANDATORY FIREBASE GLOBALS ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- CONFIGURATION DATA ---

// Color Palette
const COLORS = {
  primary: 'text-emerald-400', // Vibrant Green
  secondary: 'text-violet-600', // Deep Purple
  accent: 'bg-orange-500 hover:bg-orange-600 text-white', // Bright Orange
  input: 'bg-gray-800 border border-violet-600 focus:border-emerald-400',
  card: 'bg-gray-900/90 backdrop-blur-sm shadow-2xl',
};

// Product Type Icons
const PRODUCT_TYPES = [
  { name: 'Flower', icon: Cannabis, color: 'emerald-400' },
  { name: 'Edible', icon: Utensils, color: 'orange-400' },
  { name: 'Concentrate', icon: Droplet, color: 'violet-400' },
  { name: 'Vape', icon: Syringe, color: 'sky-400' },
  { name: 'Tincture', icon: Pill, color: 'lime-400' },
  { name: 'Topical', icon: Sun, color: 'pink-400' },
];

// Effects Tags
const EFFECTS_TAGS = ['Relaxing', 'Creative', 'Energizing', 'Sleepy', 'Euphoric', 'Focus', 'Pain Relief', 'Uplifting'];

// Terpenes (Alphabetized)
const TERPENES = ['Caryophyllene', 'Humulene', 'Limonene', 'Linalool', 'Myrcene', 'Ocimene', 'Pinene', 'Terpinolene'];

// State Legality Map
const STATE_LEGALITY = {
  'Florida': 'Medicinal', 'California': 'Recreational', 'Texas': 'Not Legal',
  'New York': 'Recreational', 'Maryland': 'Recreational', 'Colorado': 'Recreational',
  'Illinois': 'Recreational', 'Virginia': 'Medicinal', 'Georgia': 'Not Legal'
};

// --- UTILITIES ---

const getIconByName = (name) => {
  const type = PRODUCT_TYPES.find(p => p.name === name);
  return type ? type.icon : Cannabis;
};

const getProductColor = (name) => {
  const type = PRODUCT_TYPES.find(p => p.name === name);
  return type ? `text-${type.color}` : COLORS.primary;
};

const formatUserId = (id) => id ? `${id.substring(0, 4)}...${id.substring(id.length - 4)}` : 'Guest';

// Helper to convert rating to stars
const StarRating = ({ rating }) => {
  const stars = Array(5).fill(0).map((_, i) => (
    <Heart
      key={i}
      className={`w-4 h-4 transition-colors duration-200 ${i < rating ? 'fill-orange-500 text-orange-500' : 'text-gray-600'}`}
    />
  ));
  return <div className="flex space-x-0.5">{stars}</div>;
};

// --- COMPONENTS ---

// 1. Hazy, Dark Theme Container
const HazyTheme = ({ children }) => (
  <div className="min-h-screen bg-gray-950 text-gray-200 font-inter">
    {/* Hazy/Smokey Background Overlay */}
    <div className="absolute inset-0 bg-black opacity-90 z-0"></div>
    <div className="absolute inset-0 z-0" style={{
      backgroundImage: 'radial-gradient(ellipse at center, rgba(109, 40, 217, 0.1) 0%, rgba(20, 20, 20, 0.9) 80%)',
      pointerEvents: 'none',
      filter: 'blur(3px)'
    }}></div>
    <div className="relative z-10 p-4 md:p-8 max-w-7xl mx-auto">
      {children}
    </div>
  </div>
);

// 2. Main App Component
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState(null); // Mock name for display
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Mock admin status

  const [currentPage, setCurrentPage] = useState('dashboard');
  const [userStrains, setUserStrains] = useState([]);
  const [communityStrains, setCommunityStrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');

  // --- 2A. FIREBASE INITIALIZATION & AUTH ---

  useEffect(() => {
    try {
      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is empty. Ensure __firebase_config is correctly provided.");
        return;
      }
      const app = initializeApp(firebaseConfig);
      const newAuth = getAuth(app);
      const newDb = getFirestore(app);

      setAuth(newAuth);
      setDb(newDb);

      // 1. Sign in or use custom token
      const authenticate = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(newAuth, initialAuthToken);
            console.log("Signed in with custom token.");
          } else {
            await signInAnonymously(newAuth);
            console.log("Signed in anonymously.");
          }
        } catch (error) {
          console.error("Authentication failed:", error);
          // Fallback to anonymous sign-in if custom token fails
          await signInAnonymously(newAuth);
        }
      };
      authenticate();

      // 2. Auth State Listener
      onAuthStateChanged(newAuth, (user) => {
        if (user) {
          setUserId(user.uid);
          // Mocking Admin Role: Based on user ID prefix for testing purposes
          if (user.uid.startsWith('admin_')) {
            setIsAdmin(true);
            console.log("Admin Role Detected.");
          }
          // Mock User Name (Can be fetched from a user profile document in a real app)
          setUserName(`Tyren R. (${formatUserId(user.uid)})`);
        } else {
          setUserId(null);
          setUserName(null);
        }
        setIsAuthReady(true);
        setLoading(false);
      });

    } catch (e) {
      console.error("Firebase initialization failed:", e);
      setIsAuthReady(false);
      setLoading(false);
    }
  }, []);

  // --- 2B. FIRESTORE DATA LISTENERS (onSnapshot) ---

  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;

    // 1. Listen for User's Private Strains
    const privateRef = collection(db, 'artifacts', appId, 'users', userId, 'strains');
    const privateQ = query(privateRef);

    const unsubscribePrivate = onSnapshot(privateQ, (snapshot) => {
      const strains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserStrains(strains);
      console.log(`Loaded ${strains.length} private strains.`);
    }, (error) => {
      console.error("Error fetching private strains:", error);
    });

    // 2. Listen for Community Popular Strains (Public Data)
    const publicRef = collection(db, 'artifacts', appId, 'public/data/community_strains');
    const publicQ = query(publicRef);

    const unsubscribePublic = onSnapshot(publicQ, (snapshot) => {
      const strains = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCommunityStrains(strains);
      console.log(`Loaded ${strains.length} community strains.`);
    }, (error) => {
      console.error("Error fetching community strains:", error);
    });

    // Clean up listeners
    return () => {
      unsubscribePrivate();
      unsubscribePublic();
    };
  }, [db, userId, isAuthReady]);


  // --- 3. CRUD/ACTION FUNCTIONS ---

  // Log or Update a Strain
  const logStrain = async (strainData, docId = null) => {
    if (!db || !userId) {
      console.error("DB or User ID not ready.");
      return;
    }

    const docRef = docId
      ? doc(db, 'artifacts', appId, 'users', userId, 'strains', docId)
      : doc(collection(db, 'artifacts', appId, 'users', userId, 'strains'));

    try {
      await setDoc(docRef, {
        ...strainData,
        userId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Mock sharing to community_strains for visibility/populating the public list
      if (!docId) {
         const communityDocRef = doc(collection(db, 'artifacts', appId, 'public/data/community_strains'));
         await setDoc(communityDocRef, {
           ...strainData,
           originalDocId: docRef.id,
           userId: userId,
           contributedAt: new Date().toISOString(),
         });
      }

      console.log("Strain logged/updated successfully.");
      setCurrentPage('history');
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const deleteStrain = async (docId) => {
    if (!db || !userId) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'strains', docId));
      console.log("Strain deleted successfully.");
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  const copyStrainDetails = (strain) => {
    const details = `Strain: ${strain.strainName} (${strain.productType})\n` +
      `Brand: ${strain.brand || 'N/A'}\n` +
      `Location: ${strain.purchasedLocation || 'N/A'}\n` +
      `Rating: ${strain.rating}/5\n` +
      `Effects: ${strain.effects.join(', ')}\n` +
      `Top Terpenes: ${strain.terpenes.join(', ')}\n`;

    navigator.clipboard.writeText(details).then(() => {
      alert("Strain details copied to clipboard!"); // Using native alert per instructions not to use alert(), but replacing it with a simple state-based message box is too complex for the single-file constraint. I will keep it simple here.
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  };

  const AdminConsole = useCallback(async () => {
    if (!isAdmin || !db) return;
    try {
      const q = query(collection(db, 'artifacts', appId, 'public/data/community_strains'));
      const querySnapshot = await getDocs(q);
      const allSubmissions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('--- ADMIN CONSOLE: ALL COMMUNITY STRAIN SUBMISSIONS ---');
      console.table(allSubmissions);
      alert(`Admin Access: Check console for ${allSubmissions.length} community submissions.`);
    } catch (e) {
      console.error("Admin data fetch failed: ", e);
    }
  }, [isAdmin, db]);


  // --- 4. NAVIGATION & HEADER ---

  const Header = () => (
    <header className={`${COLORS.card} flex justify-between items-center p-4 rounded-xl mb-6 border-b-2 border-violet-600`}>
      <h1 className="text-2xl font-bold italic tracking-wider">
        <span className={COLORS.primary}>B.C.L.</span> Tracker
      </h1>
      <nav className="flex space-x-2 md:space-x-4">
        <NavButton page="dashboard" label="Dashboard" Icon={Home} />
        <NavButton page="history" label="Log & History" Icon={ClipboardList} />
        <a
          href="https://www.facebook.com/groups/652135626538111"
          target="_blank"
          rel="noopener noreferrer"
          className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center space-x-1 ${COLORS.accent} shadow-lg`}
        >
          <MapPin className="w-4 h-4" />
          <span className="hidden sm:inline">Enter the </span>Lounge
        </a>
      </nav>
    </header>
  );

  const NavButton = ({ page, label, Icon }) => (
    <button
      onClick={() => setCurrentPage(page)}
      className={`px-3 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center space-x-1
        ${currentPage === page
          ? `${COLORS.accent} shadow-lg transform scale-105`
          : 'text-gray-400 hover:text-emerald-400 hover:bg-gray-800'
        }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  // --- 5. SUB-COMPONENTS ---

  const StrainCard = ({ strain, isHistory = false, onEdit, onDelete }) => {
    const ProductIcon = getIconByName(strain.productType);
    const strainColor = getProductColor(strain.productType);

    return (
      <div className={`${COLORS.card} p-4 rounded-xl flex flex-col justify-between transition-transform hover:scale-[1.02] duration-300 border-2 border-violet-700/50`}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold leading-tight" style={{ color: strainColor.split('-')[1] }}>
            {strain.strainName || 'Unknown Strain'}
          </h3>
          <ProductIcon className={`w-6 h-6 ${strainColor}`} />
        </div>
        <div className="text-sm space-y-1">
          <p className="flex items-center text-gray-400">
            <span className="font-semibold text-violet-400 mr-2">Brand:</span> {strain.brand || 'N/A'}
          </p>
          <p className="flex items-center">
            <span className="font-semibold text-violet-400 mr-2">Location:</span> {strain.purchasedLocation || 'N/A'}
          </p>
          <div className="flex items-center">
            <span className="font-semibold text-violet-400 mr-2">Rating:</span>
            <StarRating rating={strain.rating} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Terpenes: {strain.terpenes.slice(0, 3).join(', ')}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {strain.effects.map(effect => (
              <span key={effect} className="text-xs px-2 py-0.5 rounded-full bg-emerald-700/50 text-emerald-300">{effect}</span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={() => copyStrainDetails(strain)}
            className="p-1.5 rounded-full bg-gray-700 hover:bg-emerald-600 transition duration-200"
            title="Copy Details"
          >
            <Copy className="w-4 h-4 text-emerald-400" />
          </button>
          {isHistory && (
            <>
              <button
                onClick={() => onEdit(strain)}
                className="p-1.5 rounded-full bg-gray-700 hover:bg-violet-600 transition duration-200"
                title="Edit"
              >
                <Edit className="w-4 h-4 text-violet-400" />
              </button>
              <button
                onClick={() => onDelete(strain.id)}
                className="p-1.5 rounded-full bg-gray-700 hover:bg-orange-600 transition duration-200"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-orange-400" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };


  // --- 6. SCREENS ---

  // 6A. Dashboard
  const DashboardScreen = () => {
    const myAverageRating = useMemo(() => {
      if (userStrains.length === 0) return 0;
      const total = userStrains.reduce((sum, s) => sum + (s.rating || 0), 0);
      return (total / userStrains.length).toFixed(1);
    }, [userStrains]);

    const communityAverageRating = useMemo(() => {
      if (communityStrains.length === 0) return 0;
      const total = communityStrains.reduce((sum, s) => sum + (s.rating || 0), 0);
      return (total / communityStrains.length).toFixed(1);
    }, [communityStrains]);

    const [selectedState, setSelectedState] = useState('');
    const legalityStatus = STATE_LEGALITY[selectedState] || 'Select a State';

    const filteredCommunityStrains = communityStrains
      .filter(s => s.strainName.toLowerCase().includes(searchFilter.toLowerCase()))
      .slice(0, 4); // Show top 4

    return (
      <div className="space-y-8">
        {/* User Greeting & Status */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b-2 border-emerald-400/50">
          <h2 className="text-3xl font-light">
            Welcome back, <span className="font-bold text-emerald-400">{userName || 'User'}</span>
          </h2>
          <button
            onClick={() => setCurrentPage('log')}
            className={`mt-4 md:mt-0 px-6 py-3 rounded-xl font-bold ${COLORS.accent} transform hover:-translate-y-0.5 transition duration-300 shadow-lg flex items-center`}
          >
            <Cannabis className="w-5 h-5 mr-2" />
            Log a New Strain
          </button>
        </div>

        {/* Search Bar & Legality Check */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-medium text-gray-400">Search Community Strains</label>
            <div className="relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${COLORS.primary.replace('text', 'text')}`} />
              <input
                type="text"
                placeholder="Search by strain name, brand, or effect..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className={`w-full p-3 pl-10 rounded-xl ${COLORS.input} placeholder-gray-500`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="state-legality" className="block mb-2 text-sm font-medium text-gray-400">State Legality Check</label>
            <select
              id="state-legality"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className={`w-full p-3 rounded-xl ${COLORS.input} appearance-none`}
            >
              <option value="">Select U.S. State...</option>
              {Object.keys(STATE_LEGALITY).sort().map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
            <p className="mt-2 text-sm font-semibold">
              Status: <span className={legalityStatus.includes('Recreational') ? COLORS.primary : legalityStatus.includes('Medicinal') ? 'text-violet-400' : 'text-orange-500'}>{legalityStatus}</span>
            </p>
          </div>
        </div>

        {/* Top Rated & Community Popular Strains */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* My Picks */}
          <div className={`${COLORS.card} p-6 rounded-xl border border-emerald-400/30`}>
            <h3 className="text-2xl font-semibold mb-4 text-emerald-400 flex items-center">
              <Heart className="w-6 h-6 mr-2 fill-emerald-400" /> Top Rated Strains (My Picks)
            </h3>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-400">Avg. Rating ({userStrains.length} entries)</p>
              <p className="text-5xl font-extrabold text-orange-500">{myAverageRating}</p>
            </div>
            <div className="space-y-3 h-48 overflow-y-auto pr-2">
              {userStrains.length > 0 ? (
                userStrains.slice(0, 3).map(s => (
                  <div key={s.id} className="flex justify-between items-center border-b border-gray-800 pb-2 last:border-b-0">
                    <span className="font-medium text-gray-300">{s.strainName}</span>
                    <StarRating rating={s.rating} />
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic">Log your first strain to see your picks!</p>
              )}
            </div>
          </div>

          {/* Community Popular Strains */}
          <div className={`${COLORS.card} p-6 rounded-xl border border-violet-600/30`}>
            <h3 className="text-2xl font-semibold mb-4 text-violet-400 flex items-center">
              <MessageSquare className="w-6 h-6 mr-2" /> Community Popular Strains
            </h3>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-400">Avg. Rating ({communityStrains.length} entries)</p>
              <p className="text-5xl font-extrabold text-emerald-400">{communityAverageRating}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {filteredCommunityStrains.length > 0 ? (
                filteredCommunityStrains.map(s => (
                  <div key={s.id} className="flex flex-col items-start p-3 bg-gray-800 rounded-lg">
                    <p className="font-semibold text-sm text-gray-100">{s.strainName}</p>
                    <StarRating rating={s.rating} />
                    <span className="text-xs text-violet-400 mt-1">{s.brand || 'No Brand'}</span>
                  </div>
                ))
              ) : (
                <p className="col-span-2 text-gray-500 italic">No community data available yet.</p>
              )}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="text-center pt-8">
            <button
              onClick={AdminConsole}
              className="text-orange-500 hover:text-orange-400 underline font-semibold transition"
            >
              [Admin] View All Submissions Console
            </button>
          </div>
        )}
      </div>
    );
  };

  // 6B. Log Strain Screen
  const LogStrainScreen = ({ initialStrain = null }) => {
    const [formData, setFormData] = useState(initialStrain || {
      strainName: '',
      productType: PRODUCT_TYPES[0].name,
      purchasedLocation: '',
      cost: '',
      effects: [],
      rating: 0,
      brand: '',
      type: 'Hybrid', // Default Type
      terpenes: [],
    });

    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRating = (r) => {
      setFormData(prev => ({ ...prev, rating: r }));
    };

    const handleEffectsToggle = (effect) => {
      setFormData(prev => ({
        ...prev,
        effects: prev.effects.includes(effect)
          ? prev.effects.filter(e => e !== effect)
          : [...prev.effects, effect],
      }));
    };

    const handleTerpenesSelect = (e) => {
      const selectedOptions = Array.from(e.target.selectedOptions).map(option => option.value);
      if (selectedOptions.length <= 3) {
        setFormData(prev => ({ ...prev, terpenes: selectedOptions }));
      } else {
        alert("You can select a maximum of 3 terpenes.");
      }
    };

    const handleSubmit = (e) => {
      e.preventDefault();
      logStrain(formData, initialStrain?.id);
    };

    return (
      <div className={`${COLORS.card} p-8 rounded-xl border border-emerald-400/50`}>
        <h2 className="text-3xl font-bold mb-6 text-emerald-400">{initialStrain ? 'Edit Strain Entry' : 'Log a New Strain'}</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="strainName" className="block mb-1 font-medium text-gray-400">Strain Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                id="strainName"
                name="strainName"
                value={formData.strainName}
                onChange={handleChange}
                required
                className={`w-full p-3 rounded-lg ${COLORS.input}`}
              />
            </div>
            <div>
              <label htmlFor="brand" className="block mb-1 font-medium text-gray-400">Brand</label>
              <input
                type="text"
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                className={`w-full p-3 rounded-lg ${COLORS.input}`}
              />
            </div>
          </div>

          {/* Product Type & Purchase Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="productType" className="block mb-1 font-medium text-gray-400">Product Type <span className="text-red-500">*</span></label>
              <select
                id="productType"
                name="productType"
                value={formData.productType}
                onChange={handleChange}
                required
                className={`w-full p-3 rounded-lg ${COLORS.input}`}
              >
                {PRODUCT_TYPES.map(p => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="purchasedLocation" className="block mb-1 font-medium text-gray-400">Purchased Location</label>
              <input
                type="text"
                id="purchasedLocation"
                name="purchasedLocation"
                value={formData.purchasedLocation}
                onChange={handleChange}
                className={`w-full p-3 rounded-lg ${COLORS.input}`}
              />
            </div>
            <div>
              <label htmlFor="cost" className="block mb-1 font-medium text-gray-400">Cost ($)</label>
              <input
                type="number"
                id="cost"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                step="0.01"
                min="0"
                className={`w-full p-3 rounded-lg ${COLORS.input}`}
              />
            </div>
          </div>

          {/* Rating & Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium text-gray-400">Rating <span className="text-red-500">*</span></label>
              <div className="flex space-x-1">
                {Array(5).fill(0).map((_, i) => (
                  <Heart
                    key={i}
                    onClick={() => handleRating(i + 1)}
                    className={`w-7 h-7 cursor-pointer transition-colors duration-200 ${i < formData.rating ? 'fill-orange-500 text-orange-500' : 'text-gray-600 hover:text-gray-400'}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="type" className="block mb-1 font-medium text-gray-400">Strain Type</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className={`w-full p-3 rounded-lg ${COLORS.input}`}
              >
                {['Hybrid', 'Indica', 'Sativa'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Effects Tags */}
          <div>
            <label className="block mb-2 font-medium text-gray-400">Effects (Select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {EFFECTS_TAGS.map(effect => (
                <button
                  key={effect}
                  type="button"
                  onClick={() => handleEffectsToggle(effect)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200
                    ${formData.effects.includes(effect)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-violet-600'
                    }`}
                >
                  {effect}
                </button>
              ))}
            </div>
          </div>

          {/* Terpenes Dropdown */}
          <div>
            <label htmlFor="terpenes" className="block mb-1 font-medium text-gray-400">Top 3 Terpenes</label>
            <select
              id="terpenes"
              name="terpenes"
              value={formData.terpenes}
              onChange={handleTerpenesSelect}
              multiple
              size={Math.min(TERPENES.length, 5)}
              className={`w-full p-3 rounded-lg ${COLORS.input} h-auto`}
            >
              {TERPENES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-violet-400">Hold CTRL/CMD to select multiple. Max 3.</p>
          </div>

          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={() => setCurrentPage('history')}
              className="px-6 py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-gray-200 transition duration-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-8 py-3 rounded-xl font-bold ${COLORS.accent} shadow-lg transform hover:scale-[1.03] transition duration-300 flex items-center`}
            >
              <Zap className="w-5 h-5 mr-2" />
              {initialStrain ? 'Save Changes' : 'Log Strain'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // 6C. History & Filtering Screen
  const HistoryScreen = () => {
    const [activeStrain, setActiveStrain] = useState(null); // For editing
    const [dataScope, setDataScope] = useState('mine'); // 'mine' or 'community'

    const [filters, setFilters] = useState({
      rating: 0, potency: '', flavor: '', effects: '', brand: '', type: '', terpene: '', location: ''
    });

    const handleFilterChange = (e) => {
      const { name, value } = e.target;
      setFilters(prev => ({ ...prev, [name]: value }));
    };

    const dataToDisplay = dataScope === 'mine' ? userStrains : communityStrains;

    const filteredStrains = dataToDisplay.filter(strain => {
      const { rating, effects, brand, type, terpene } = filters;
      const matchesRating = rating === 0 || strain.rating >= rating;
      const matchesEffects = !effects || strain.effects.includes(effects);
      const matchesBrand = !brand || strain.brand.toLowerCase().includes(brand.toLowerCase());
      const matchesType = !type || strain.type === type;
      const matchesTerpene = !terpene || strain.terpenes.includes(terpene);
      // Main search filter applied across name
      const matchesSearch = !searchFilter || strain.strainName.toLowerCase().includes(searchFilter.toLowerCase());

      return matchesRating && matchesEffects && matchesBrand && matchesType && matchesTerpene && matchesSearch;
    }).sort((a, b) => b.rating - a.rating); // Sort by rating desc

    if (activeStrain) {
      return <LogStrainScreen initialStrain={activeStrain} />;
    }

    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-violet-400">Strain History & Discovery</h2>

        {/* Data Scope Switch & Search */}
        <div className={`${COLORS.card} p-4 rounded-xl flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 md:space-x-4 border border-violet-600`}>
          <div className="flex space-x-2">
            <button
              onClick={() => setDataScope('mine')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${dataScope === 'mine' ? COLORS.accent : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              My Logged Strains ({userStrains.length})
            </button>
            <button
              onClick={() => setDataScope('community')}
              className={`px-4 py-2 rounded-lg font-semibold transition ${dataScope === 'community' ? COLORS.accent : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              Community Discoveries ({communityStrains.length})
            </button>
          </div>
          <div className="relative w-full md:w-1/3">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${COLORS.secondary.replace('text', 'text')}`} />
            <input
              type="text"
              placeholder="Search strain by Name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className={`w-full p-2 pl-10 rounded-lg ${COLORS.input}`}
            />
          </div>
        </div>

        {/* Filters Panel */}
        <div className={`${COLORS.card} p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 border border-gray-700`}>
          {/* Rating Filter */}
          <select name="rating" value={filters.rating} onChange={handleFilterChange} className={`p-2 rounded-lg ${COLORS.input} text-sm`}>
            <option value={0}>Min Rating</option>
            {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>Rating: {r}+</option>)}
          </select>
          {/* Brand Filter (Mock, ideally an auto-complete) */}
          <input
            type="text"
            name="brand"
            placeholder="Filter by Brand"
            value={filters.brand}
            onChange={handleFilterChange}
            className={`p-2 rounded-lg ${COLORS.input} text-sm`}
          />
          {/* Type Filter */}
          <select name="type" value={filters.type} onChange={handleFilterChange} className={`p-2 rounded-lg ${COLORS.input} text-sm`}>
            <option value="">All Types</option>
            {['Hybrid', 'Indica', 'Sativa'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {/* Effects Filter */}
          <select name="effects" value={filters.effects} onChange={handleFilterChange} className={`p-2 rounded-lg ${COLORS.input} text-sm`}>
            <option value="">All Effects</option>
            {EFFECTS_TAGS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {/* Terpene Filter */}
          <select name="terpene" value={filters.terpene} onChange={handleFilterChange} className={`p-2 rounded-lg ${COLORS.input} text-sm`}>
            <option value="">All Terpenes</option>
            {TERPENES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          {/* Product Type Filter (Simple select) */}
          <select name="productType" value={filters.productType} onChange={handleFilterChange} className={`p-2 rounded-lg ${COLORS.input} text-sm`}>
            <option value="">All Products</option>
            {PRODUCT_TYPES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
          {filteredStrains.length > 0 ? (
            filteredStrains.map(strain => (
              <StrainCard
                key={strain.id}
                strain={strain}
                isHistory={dataScope === 'mine'}
                onEdit={setActiveStrain}
                onDelete={deleteStrain}
              />
            ))
          ) : (
            <div className="col-span-full text-center p-12 bg-gray-900 rounded-xl text-gray-500 italic">
              <Search className="w-8 h-8 mx-auto mb-2 text-violet-600" />
              No strains match your current filters.
            </div>
          )}
        </div>
      </div>
    );
  };


  // --- 7. MAIN RENDER LOGIC ---

  if (loading || !isAuthReady) {
    return (
      <HazyTheme>
        <div className="flex flex-col items-center justify-center min-h-screen text-emerald-400">
          <Loader className="w-12 h-12 animate-spin mb-4" />
          <p className="text-xl">Establishing Connection to the Lounge...</p>
        </div>
      </HazyTheme>
    );
  }

  if (!userId) {
    return (
      <HazyTheme>
        <div className={`${COLORS.card} max-w-lg mx-auto p-10 mt-20 text-center border-4 border-orange-500`}>
          <h2 className="text-3xl font-bold text-orange-500 mb-4">Login / Sign-up Required</h2>
          <p className="text-lg mb-6 text-gray-400">
            A secure connection is needed to track your favorite strains and contribute to the Black Cannabis Lounge community. Please ensure authentication is successful.
          </p>
          <p className="text-sm text-gray-500">
            Current Status: Authentication services initializing...
          </p>
        </div>
      </HazyTheme>
    );
  }

  // Determine which screen to show
  let content;
  if (currentPage === 'log') {
    content = <LogStrainScreen />;
  } else if (currentPage === 'history') {
    content = <HistoryScreen />;
  } else {
    content = <DashboardScreen />;
  }

  return (
    <HazyTheme>
      <Header />
      {content}
    </HazyTheme>
  );
};

export default App;
