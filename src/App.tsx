import { motion, AnimatePresence } from "motion/react";
import { Terminal, Shield, Zap, Globe, Github, ChevronRight, Codesandbox, ShoppingCart, Layers, User, X, CheckCircle2, LogOut, Settings, Users, Plus, Trash2, Edit3, LayoutDashboard, Clock, FileText, Send, Phone, MessageSquare, Briefcase, Award, GraduationCap, Link as LinkIcon, CheckCircle, Activity, BarChart3, Users2, Eye, MousePointer2 } from "lucide-react";
import { useState, useEffect, ReactNode, MouseEvent, useRef, FormEvent } from "react";
import { auth, googleProvider, syncUserProfile, UserProfile, db, addProduct, updateProduct, deleteProduct, Product, Task, ServiceRequest, submitServiceRequest, assignTask, updateTaskStatus, sendSupportMessage, logActivity, SupportMessage, ActivityLog } from "./lib/firebase";
import { signInWithPopup, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, query, orderBy, where, limit } from "firebase/firestore";

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cartCount, setCartCount] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Auth & Admin State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTeamConsole, setShowTeamConsole] = useState(false);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [isEditingProduct, setIsEditingProduct] = useState<Product | null>(null);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<UserProfile | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userProfile = await syncUserProfile(firebaseUser);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Products from Firestore
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pData = snapshot.docs.map(doc => doc.data() as Product);
      setProducts(pData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Tasks
  useEffect(() => {
    if (profile) {
      let q;
      if (profile.role === 'owner' || profile.role === 'admin') {
        q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      } else {
        q = query(collection(db, 'tasks'), where('assigneeId', '==', profile.uid), orderBy('createdAt', 'desc'));
      }
      return onSnapshot(q, (snapshot) => {
        setTasks(snapshot.docs.map(doc => doc.data() as Task));
      });
    }
  }, [profile]);

  // Fetch Service Requests (Admins only)
  useEffect(() => {
    if (profile?.role === 'owner' || profile?.role === 'admin') {
      const q = query(collection(db, 'serviceRequests'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, (snapshot) => {
        setServiceRequests(snapshot.docs.map(doc => doc.data() as ServiceRequest));
      });
    }
  }, [profile]);

  // Fetch Team for Owner/Admin
  useEffect(() => {
    if (profile?.role === 'owner' || profile?.role === 'admin') {
      const q = collection(db, 'users');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const members = snapshot.docs.map(doc => doc.data() as UserProfile);
        setTeamMembers(members);
      });
      return () => unsubscribe();
    }
  }, [profile]);
  
  // Fetch Support Messages
  useEffect(() => {
    if (profile) {
      let q;
      if (profile.role === 'owner' || profile.role === 'admin') {
        q = query(collection(db, 'supportMessages'), orderBy('createdAt', 'asc'));
      } else {
        q = query(collection(db, 'supportMessages'), where('senderId', '==', profile.uid), orderBy('createdAt', 'asc'));
      }
      return onSnapshot(q, (snapshot) => {
        setSupportMessages(snapshot.docs.map(doc => doc.data() as SupportMessage));
      });
    }
  }, [profile]);

  // Fetch Activity Logs (Owner Only)
  useEffect(() => {
    if (profile?.role === 'owner') {
      const q = query(collection(db, 'activityLogs'), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(q, (snapshot) => {
        setActivityLogs(snapshot.docs.map(doc => doc.data() as ActivityLog));
      });
    }
  }, [profile]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast("Kirish ruxsat etildi: Autentifikatsiya muvaffaqiyatli");
      if (auth.currentUser) {
        logActivity({
          userId: auth.currentUser.uid,
          userEmail: auth.currentUser.email || 'anonim',
          action: 'KIRISH',
          details: "Google Auth orqali tizimga kirildi"
        });
      }
    } catch (error) {
      console.error("Login failed", error);
      showToast("Kirish rad etildi: Ulashish hatosi", 'error');
    }
  };

  const handleLogout = () => {
    if (user) {
      logActivity({
        userId: user.uid,
        userEmail: user.email || 'anonim',
        action: 'CHIQISH',
        details: "Sessiya qo'lda yakunlandi"
      });
    }
    signOut(auth);
    showToast("Sessiya yakunlandi");
  };

  const setMemberRole = async (uid: string, newRole: 'admin' | 'member') => {
    if (profile?.role !== 'owner') return;
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { 
        role: newRole,
        updatedAt: serverTimestamp()
      });
      showToast(`Huquqlar yangilandi: ${newRole === 'admin' ? 'ADMIN' : "A'ZO"}`);
    } catch (error) {
      console.error("Update role failed", error);
      showToast("Ichki xato: Huquqlarni yangilab bo'lmadi", 'error');
    }
  };

  const addToCart = (e: MouseEvent) => {
    e.stopPropagation();
    setCartCount(prev => prev + 1);
    showToast("Aktiv keshlandi: Savatga qo'shildi");
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden select-none">
        <Navbar 
          cartCount={cartCount} 
          user={user}
          profile={profile}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onStartProject={() => setShowConsultModal(true)}
          onOpenAdmin={() => setShowAdminPanel(true)}
          onOpenConsole={() => setShowTeamConsole(true)}
        />

      <main className="flex-1 overflow-hidden grid grid-cols-12 gap-px bg-slate-200">
        {/* Left Panel: Directory & Filters */}
        <section className="col-span-3 bg-white p-6 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono">Muhandislik Kategoriyalari</h3>
            <div className="space-y-1">
              <CategoryItem label="Barcha yechimlar" count={products.length} active={selectedCategory === "all"} onClick={() => setSelectedCategory("all")} />
              <CategoryItem label="Asosiy infratuzilma" count={products.filter(p => p.category === "Core Infrastructure").length} active={selectedCategory === "Core Infrastructure"} onClick={() => setSelectedCategory("Core Infrastructure")} />
              <CategoryItem label="Autentifikatsiya SDK'lari" count={products.filter(p => p.category === "Authentication SDKs").length} active={selectedCategory === "Authentication SDKs"} onClick={() => setSelectedCategory("Authentication SDKs")} />
              <CategoryItem label="Ma'lumotlar orkestratsiyasi" count={products.filter(p => p.category === "Data Orchestration").length} active={selectedCategory === "Data Orchestration"} onClick={() => setSelectedCategory("Data Orchestration")} />
              <CategoryItem label="Bulutli avtomatlashtirish" count={products.filter(p => p.category === "Cloud Automation").length} active={selectedCategory === "Cloud Automation"} onClick={() => setSelectedCategory("Cloud Automation")} />
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono">Jamoa Holati</h3>
            <div className="flex flex-col gap-4">
              <AvailabilityCard 
                status="online" 
                title="Maxsus ishlab chiqish" 
                description="Loyihalar qabul qilinmoqda. Navbat: 14 kun." 
              />
              <AvailabilityCard 
                status="busy" 
                title="Xavfsizlik auditi" 
                description="Hozirda band. Faqat korporativ mijozlar uchun." 
              />
            </div>
          </div>

          <div className="mt-auto">
            <div className="p-4 bg-slate-900 rounded-lg text-white">
              <p className="text-[10px] font-bold text-blue-400 uppercase mb-1 font-mono">Hamkorlar tarmog'i</p>
              <p className="text-xs opacity-70 mb-3">24+ ixtisoslashgan muhandislar jamoasiga qo'shiling.</p>
              <button 
                onClick={() => setShowConsultModal(true)}
                className="w-full py-2 border border-white/20 rounded text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
              >
                Nexus'ga qo'shiling
              </button>
            </div>
          </div>
        </section>

        {/* Center Panel: Marketplace & SDKs */}
        <section className="col-span-6 bg-slate-50 p-8 flex flex-col overflow-y-auto">
          <div className="flex justify-between items-center mb-8 gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-light tracking-tight text-slate-800 shrink-0">Elita <span className="font-bold">Bozori</span></h1>
              <p className="text-sm text-slate-500 whitespace-nowrap">Professional jamoalar uchun tayyor modullar.</p>
            </div>
            
            <div className="flex-1 max-w-sm relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <input 
                type="text" 
                placeholder="Qidiruv..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
              />
            </div>

            <div className="flex border border-slate-200 rounded overflow-hidden shadow-sm shrink-0">
              <button className="px-4 py-2 bg-white text-xs font-bold border-r border-slate-200 hover:bg-slate-50 transition-colors">TO'R</button>
              <button className="px-4 py-2 bg-slate-100 text-xs text-slate-400 hover:bg-slate-200 transition-colors">RO'YXAT</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pb-20">
            <AnimatePresence mode="popLayout">
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    exit={{ opacity: 0 }}
                    key={i} 
                    className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" 
                  />
                ))
              ) : (
                filteredProducts.map((p, idx) => (
                  <ProductCard 
                    key={p.id} 
                    product={p} 
                    index={idx} 
                    onClick={() => setSelectedProduct(p)}
                    onAddToCart={(e) => {
                      e.stopPropagation();
                      if (user) {
                        logActivity({
                          userId: user.uid,
                          userEmail: user.email || 'anonim',
                          action: 'SAVATGA_QOSHISH',
                          details: `${p.name} savatga qo'shildi`
                        });
                      }
                      addToCart(p);
                    }}
                  />
                ))
              )}
            </AnimatePresence>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              className="col-span-2 bg-blue-600 rounded-xl p-6 text-white flex items-center gap-8 shadow-lg shadow-blue-200 mt-4 relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 p-8 transform rotate-12 opacity-10">
                 <Codesandbox className="w-48 h-48" />
               </div>
              <div className="flex-1 relative z-10">
                <h3 className="text-lg font-bold mb-1">Asosiy jamoamizni yollang</h3>
                <p className="text-sm opacity-80 mb-4">Murakkab SaaS arxitekturalari va tizimlarni ko'chirish bo'yicha professional ijro.</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowConsultModal(true)}
                    className="bg-white text-blue-600 px-4 py-2 rounded font-bold text-xs uppercase tracking-wide hover:bg-slate-100 transition-colors"
                  >
                    Konsultatsiya
                  </button>
                  <button className="border border-white/30 px-4 py-2 rounded font-bold text-xs uppercase tracking-wide hover:bg-white/10 transition-colors">Muvaffaqiyatlar</button>
                </div>
              </div>
              <div className="w-24 h-24 opacity-20 hidden md:block relative z-10">
                <Shield className="w-full h-full" strokeWidth={1} />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Right Panel: Activity & Portfolio */}
        <section className="col-span-3 bg-white border-l border-slate-200 p-6 flex flex-col overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl p-6 text-white mb-8 shadow-xl shadow-slate-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <MessageSquare className="w-20 h-20 rotate-12" />
            </div>
            <h3 className="text-lg font-bold mb-2">Bog'lanish</h3>
            <p className="text-xs opacity-70 mb-4 font-mono uppercase tracking-[0.1em]">Muhandis onlayn</p>
            <div className="space-y-3">
              <a href="https://t.me/mr1s_tuyginov" className="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
                <Send className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Telegram @mr1s_tuyginov</span>
              </a>
              <a href="tel:+998950097129" className="flex items-center gap-3 bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all">
                <Phone className="w-4 h-4 text-green-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">+998 95 009 71 29</span>
              </a>
            </div>
            <button 
              onClick={() => setShowConsultModal(true)}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-blue-900"
            >
              Xizmat buyurtma qilish
            </button>
          </div>

          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono">Oxirgi yetkazib berishlar</h3>
          <div className="space-y-4 mb-8">
            <DeliveryItem color="bg-green-500" title="Fintech Portal V2" subtitle="Maxsus qurilish • 12 kun oldin" />
            <DeliveryItem color="bg-blue-500" title="Vector DB SDK" subtitle="SDK Reliz • 2 kun oldin" />
            <DeliveryItem color="bg-slate-200" title="E-commerce Engine" subtitle="Texnik xizmat • Davom etmoqda" />
          </div>

          <div className="mt-auto border-t border-slate-100 pt-6">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 font-mono">Faol muhandislik seanslari</h3>
            <div className="grid grid-cols-4 gap-2">
              {teamMembers.slice(0, 4).map((m, i) => (
                <div key={i} title={m.displayName} className="relative">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-bold text-xs ring-2 ring-white">
                    {m.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm" />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-3 italic">*{teamMembers.length} ta mutaxassis navbatchilikda</p>
          </div>
        </section>
      </main>

      {/* Support Chat Floating Button */}
      {user && (
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`fixed bottom-8 right-8 z-40 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 ${
            isChatOpen ? 'bg-slate-900 border-2 border-blue-500 rotate-90 scale-110' : 'bg-blue-600 hover:bg-blue-700 -rotate-12 hover:rotate-0'
          }`}
        >
          {isChatOpen ? <X className="w-6 h-6 text-white" /> : <MessageSquare className="w-6 h-6 text-white" />}
          {!isChatOpen && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          )}
        </button>
      )}

      {/* Support Message Widget */}
      <AnimatePresence>
        {isChatOpen && user && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 right-8 z-40 w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[500px]"
          >
            <SupportChat 
              messages={supportMessages} 
              user={user} 
              profile={profile} 
              onSendMessage={sendSupportMessage} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: -20, x: '-50%' }}
            exit={{ opacity: 0, y: 50, x: '-50%' }}
            className={`fixed bottom-10 left-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
              toast.type === 'success' ? 'bg-slate-900 border-blue-500 text-blue-400' : 'bg-red-50 border-red-200 text-red-600'
            }`}
          >
            {toast.type === 'success' ? <Terminal className="w-5 h-5" /> : <X className="w-5 h-5" />}
            <span className="text-xs font-bold uppercase tracking-widest font-mono">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showAdminPanel && (
          <Modal onClose={() => setShowAdminPanel(false)} wide>
            <AdminPanel 
              products={products} 
              serviceRequests={serviceRequests}
              activityLogs={activityLogs}
              profile={profile}
              onClose={() => setShowAdminPanel(false)}
              onEditProduct={(p) => setIsEditingProduct(p)}
              onDeleteProduct={deleteProduct}
            />
          </Modal>
        )}

        {showTeamConsole && (
          <Modal onClose={() => setShowTeamConsole(false)} wide>
            <TeamConsole 
              teamMembers={teamMembers} 
              tasks={tasks}
              profile={profile}
              onClose={() => setShowTeamConsole(false)}
              onSetRole={setMemberRole}
              onOpenPortfolio={(m) => setSelectedTeamMember(m)}
            />
          </Modal>
        )}

        {selectedTeamMember && (
          <Modal onClose={() => setSelectedTeamMember(null)}>
            <PortfolioDetails member={selectedTeamMember} onClose={() => setSelectedTeamMember(null)} />
          </Modal>
        )}

        {isEditingProduct !== null && (
          <Modal onClose={() => setIsEditingProduct(null)}>
            <ProductForm 
              initialData={isEditingProduct.id === 'new' ? undefined : isEditingProduct} 
              onSubmit={async (data) => {
                try {
                  if (isEditingProduct.id === 'new') {
                    await addProduct({ ...data, authorId: user?.uid || '' });
                    showToast("Aktiv yaratildi: Muvaffaqiyatli");
                  } else {
                    await updateProduct(isEditingProduct.id, data);
                    showToast("Aktiv sinxronlandi: Muvaffaqiyatli");
                  }
                  setIsEditingProduct(null);
                } catch (e) {
                  showToast("O'rnatish muvaffaqiyatsiz tugadi: Yozish xatosi", 'error');
                }
              }}
              onCancel={() => setIsEditingProduct(null)}
            />
          </Modal>
        )}

        {selectedProduct && (
          <Modal onClose={() => setSelectedProduct(null)}>
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                  <Codesandbox className="w-8 h-8" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-slate-400 uppercase mb-1">{selectedProduct.type}</div>
                  <div className="text-3xl font-bold font-mono text-blue-600">${selectedProduct.price}</div>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedProduct.name}</h2>
                <div className="flex gap-2 mb-6">
                  <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold rounded uppercase tracking-tighter text-slate-500">{selectedProduct.category}</span>
                  <span className="px-2 py-0.5 bg-green-100 text-[10px] font-bold rounded uppercase tracking-tighter text-green-600">Enterprise Ready</span>
                </div>
                <p className="text-slate-500 leading-relaxed text-lg">
                  {selectedProduct.description} This production-grade module includes full documentation, 
                  TypeScript types, and 24/7 priority support from our core engineering team. 
                  Optimized for multi-tenant architectures and low-latency environments.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <Shield className="w-5 h-5 text-blue-600 mb-2" />
                  <div className="text-xs font-bold uppercase tracking-tight">Security Audit</div>
                  <div className="text-[10px] text-slate-400">SOC2 Type II Compliant</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <Zap className="w-5 h-5 text-amber-500 mb-2" />
                  <div className="text-xs font-bold uppercase tracking-tight">Performance</div>
                  <div className="text-[10px] text-slate-400">&lt; 15ms Avg Latency</div>
                </div>
              </div>
              <div className="flex gap-4 mt-4 pt-6 border-t border-slate-100">
                <button 
                  onClick={() => {
                    setCartCount(prev => prev + 1);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" /> Add to Cart
                </button>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="px-6 py-4 border border-slate-200 rounded-xl font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showConsultModal && (
          <Modal onClose={() => setShowConsultModal(false)}>
            <ServiceRequestForm 
              onSubmit={async (data) => {
                try {
                  await submitServiceRequest(data);
                  if (user) {
                    logActivity({
                      userId: user.uid,
                      userEmail: user.email || 'anonim',
                      action: 'LOYIHA_SOROVI',
                      details: `${data.projectType} uchun so'rov yuborildi`
                    });
                  }
                  showToast("O'rnatish so'rovi yuborildi");
                  setShowConsultModal(false);
                } catch (e) {
                  showToast("So'rov yuborishda xato", 'error');
                }
              }} 
              onCancel={() => setShowConsultModal(false)} 
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Navbar({ cartCount, user, profile, onLogin, onLogout, onStartProject, onOpenAdmin, onOpenConsole }: { 
  cartCount: number; 
  user: FirebaseUser | null;
  profile: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  onStartProject: () => void;
  onOpenAdmin: () => void;
  onOpenConsole: () => void;
}) {
  return (
    <nav className="h-16 border-b border-slate-200 bg-white px-8 flex items-center justify-between z-10 shrink-0 shadow-sm relative font-sans">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center group-hover:rotate-12 transition-transform shadow-lg shadow-blue-200">
            <Codesandbox className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight uppercase">Nexus<span className="text-blue-600">Dev</span></span>
        </div>
        <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
        <div className="hidden md:flex gap-6 text-sm font-medium text-slate-500 uppercase tracking-widest">
          <a href="#" className="text-blue-600 border-b-2 border-blue-600 pb-0.5">Yechimlar</a>
          <a href="#" className="hover:text-slate-900 transition-colors">SDK Reyestri</a>
          {(profile?.role === 'owner' || profile?.role === 'admin') && (
            <>
              <button onClick={onOpenAdmin} className="flex items-center gap-2 hover:text-blue-600 transition-colors uppercase tracking-widest font-bold">
                <LayoutDashboard className="w-4 h-4" /> Admin
              </button>
              <button onClick={onOpenConsole} className="flex items-center gap-2 hover:text-blue-600 transition-colors uppercase tracking-widest font-bold">
                <Settings className="w-4 h-4" /> Konsol
              </button>
            </>
          )}
          <a href="#" className="hover:text-slate-900 transition-colors">Mijoz Portali</a>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative p-2 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer mr-2">
          <ShoppingCart className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
              {cartCount}
            </span>
          )}
        </div>
        
        {user ? (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] text-white font-bold">
                {profile?.displayName?.slice(0, 1).toUpperCase() || 'U'}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-tighter">
                {profile?.role === 'owner' ? 'EGA' : profile?.role === 'admin' ? 'ADMIN' : "A'ZO"}
              </div>
              <button onClick={onLogout} className="ml-2 text-slate-400 hover:text-red-500 transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <button 
              onClick={onStartProject}
              className="bg-slate-900 text-white px-5 py-2 text-[10px] font-bold uppercase tracking-wider rounded hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
            >
              Loyihani Boshlash
            </button>
          </div>
        ) : (
          <button 
            onClick={onLogin}
            className="bg-blue-600 text-white px-5 py-2 text-[10px] font-bold uppercase tracking-wider rounded hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 flex items-center gap-2"
          >
            <User className="w-4 h-4" /> Kirish
          </button>
        )}
      </div>
    </nav>
  );
}

function CategoryItem({ label, count, active = false, onClick }: { label: string; count: number; active?: boolean; onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex justify-between items-center p-2 rounded border font-medium text-sm transition-all cursor-pointer transform active:scale-95 ${
        active 
          ? "bg-blue-50 text-blue-700 border-blue-100 translate-x-1" 
          : "hover:bg-slate-50 text-slate-600 border-transparent hover:translate-x-1"
      }`}
    >
      <span>{label}</span>
      <span className={`text-[10px] px-1.5 rounded transition-colors ${active ? "bg-blue-200" : "bg-slate-100"}`}>{count}</span>
    </div>
  );
}

function AvailabilityCard({ status, title, description }: { status: "online" | "busy"; title: string; description: string }) {
  return (
    <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 hover:bg-white transition-colors cursor-help">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-2 h-2 rounded-full ${status === "online" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`}></div>
        <span className="text-xs font-bold">{title}</span>
      </div>
      <p className="text-[11px] text-slate-500 leading-tight">{description}</p>
    </div>
  );
}

function ProductCard({ product, index, onClick, onAddToCart }: { 
  product: Product; 
  index: number; 
  key?: string;
  onClick: () => void;
  onAddToCart: (e: MouseEvent) => void;
}) {
  const categoryIcons: Record<string, any> = {
    'Core Infrastructure': Zap,
    'Authentication SDKs': Shield,
    'Data Orchestration': Layers,
    'Cloud Automation': Globe
  };
  const Icon = categoryIcons[product.category] || Codesandbox;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="bg-white border border-slate-200 p-5 rounded-xl flex flex-col gap-4 shadow-sm group hover:border-blue-500 hover:shadow-md transition-all cursor-pointer relative"
    >
      <div className="flex justify-between items-start">
        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-blue-600 border border-slate-100 group-hover:bg-blue-50 transition-colors shadow-sm">
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-bold text-slate-400 tracking-tighter uppercase font-mono">{product.type} v1.0.0</span>
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1 group-hover:text-blue-600 transition-colors">{product.name}</h4>
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{product.description}</p>
      </div>
      <div className="flex justify-between items-center mt-auto border-t border-slate-50 pt-4">
        <span className="font-bold text-blue-600 text-lg font-mono">${product.price}<span className="text-[10px] font-medium text-slate-400 uppercase ml-1">/LICENSE</span></span>
        <div className="flex gap-2">
          <button 
            onClick={onAddToCart}
            className="p-2 rounded bg-slate-50 text-slate-400 hover:bg-green-600 hover:text-white transition-all transform hover:scale-105"
            title="Add to Cart"
          >
            <ShoppingCart className="w-4 h-4" />
          </button>
          <button className="p-2 rounded bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:scale-105">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function DeliveryItem({ color, title, subtitle }: { color: string; title: string; subtitle: string }) {
  return (
    <div className="flex gap-3 group cursor-pointer">
      <div className={`w-1 ${color} rounded-full transition-all group-hover:w-1.5`}></div>
      <div>
        <p className="text-xs font-bold tracking-tight group-hover:text-blue-600 transition-colors">{title}</p>
        <p className="text-[10px] text-slate-400 font-mono">{subtitle}</p>
      </div>
    </div>
  );
}

function SessionAvatar({ initials, active = false }: { initials: string; active?: boolean }) {
  return (
    <div 
      className={`aspect-square bg-slate-50 rounded-md border-2 flex items-center justify-center text-[10px] font-bold transition-all transform hover:scale-110 cursor-pointer ${
        active ? "border-green-400 text-slate-900 shadow-sm" : "border-slate-200 text-slate-300"
      }`}
      title={active ? "Online Lead Engineer" : "Offline"}
    >
      {initials}
    </div>
  );
}

function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto`}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

function AdminPanel({ products, serviceRequests, activityLogs, profile, onClose, onEditProduct, onDeleteProduct }: {
  products: Product[];
  serviceRequests: ServiceRequest[];
  activityLogs: ActivityLog[];
  profile: UserProfile | null;
  onClose: () => void;
  onEditProduct: (p: Product) => void;
  onDeleteProduct: (id: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'products' | 'requests' | 'insights'>('products');

  const stats = {
    totalAssets: products.length,
    newRequests: serviceRequests.filter(r => r.status === 'new').length
  };

  const tabs = ['products', 'requests'];
  if (profile?.role === 'owner') tabs.push('insights');

  const tabLabels: Record<string, string> = {
    products: 'Inventar',
    requests: "So'rovlar",
    insights: 'Tahlillar'
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nexus <span className="text-blue-600">Admin</span></h2>
          <p className="text-xs text-slate-400 uppercase font-mono tracking-widest mt-1">Tizimni boshqarish paneli</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 font-bold text-[8px] uppercase tracking-[0.1em]">
          {tabs.map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg transition-all ${activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Jami Aktivlar', value: stats.totalAssets, icon: Layers, color: 'text-blue-600' },
          { label: "Yangi So'rovlar", value: stats.newRequests, icon: MessageSquare, color: 'text-green-600' }
        ].map((s, i) => (
          <div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold font-mono">{s.value}</div>
            <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'products' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono">Bozordagi Inventar</h3>
              <button 
                onClick={() => onEditProduct({ id: 'new', name: '', description: '', price: 0, category: 'Core Infrastructure', type: 'SDK', authorId: '', createdAt: null })}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
              >
                <Plus className="w-4 h-4" /> Aktiv qo'shish
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-3">
              {products.map(p => (
                <div key={p.id} className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-xl group hover:border-blue-200 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-blue-600">
                      <Codesandbox className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-mono">{p.type} • {p.category}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-600 font-mono">${p.price}</div>
                      <div className="text-[8px] text-slate-400 uppercase tracking-widest">Narxlash modeli</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => onEditProduct(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-white rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono">Mijozlar So'rovlari</h3>
            <div className="grid grid-cols-1 gap-3">
              {serviceRequests.map(req => (
                <div key={req.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm font-bold">{req.customerName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{req.customerContact}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                      req.status === 'accepted' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {req.projectType} • {req.status === 'new' ? 'YANGI' : req.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 p-2 bg-white rounded border border-slate-100">{req.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'insights' && profile?.role === 'owner' && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" /> Jonli tasma (Faqat Ega uchun)
                </h3>
                <span className="text-[8px] font-bold text-blue-600 animate-pulse uppercase">Real-vaqt sinxronizatsiyasi</span>
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {activityLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-4 p-3 bg-white rounded-xl border border-slate-100 group hover:border-blue-200 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
                      {log.action === 'LOGIN' ? <Eye className="w-4 h-4 text-green-500" /> : <MousePointer2 className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold text-slate-900 truncate">{log.userEmail}</span>
                        <span className="text-[8px] font-mono text-slate-400">
                          {log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleTimeString() : 'Hozirgina'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold uppercase py-0.5 px-1.5 bg-slate-100 text-slate-500 rounded">{log.action === 'LOGIN' ? 'KIRISH' : log.action === 'LOGOUT' ? 'CHIQISH' : log.action}</span>
                        <p className="text-[10px] text-slate-500 truncate">{log.details}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamConsole({ teamMembers, tasks, profile, onClose, onSetRole, onOpenPortfolio }: {
  teamMembers: UserProfile[];
  tasks: Task[];
  profile: UserProfile | null;
  onClose: () => void;
  onSetRole: (uid: string, role: 'admin' | 'member') => void;
  onOpenPortfolio: (m: UserProfile) => void;
}) {
  const [activeTab, setActiveTab] = useState<'team' | 'tasks'>('team');

  const stats = {
    teamSize: teamMembers.length,
    pendingTasks: tasks.filter(t => t.status !== 'verified').length,
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Nexus <span className="text-blue-600">Konsoli</span></h2>
          <p className="text-xs text-slate-400 uppercase font-mono tracking-widest mt-1">Muhandislik operatsiyalari</p>
        </div>
        <div className="flex bg-slate-100 rounded-xl p-1 font-bold text-[8px] uppercase tracking-[0.1em]">
          <button 
            onClick={() => setActiveTab('team')}
            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'team' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Muhandislar
          </button>
          <button 
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 rounded-lg transition-all ${activeTab === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Vazifalar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Faol Jamoa', value: stats.teamSize, icon: Users, color: 'text-indigo-600' },
          { label: 'Kutilayotgan Vazifalar', value: stats.pendingTasks, icon: Clock, color: 'text-amber-600' }
        ].map((s, i) => (
          <div key={i} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold font-mono">{s.value}</div>
            <div className="text-[9px] font-bold text-slate-400 uppercase mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'team' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono">Muhandislar Ro'yxati</h3>
            <div className="grid grid-cols-1 gap-3">
              {teamMembers.map(member => (
                <div key={member.uid} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${
                      member.role === 'owner' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200'
                    }`}>
                      {member.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold flex items-center gap-2">
                        {member.displayName}
                        {member.role === 'owner' && <Shield className="w-3 h-3 text-blue-600" />}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{member.email}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => onOpenPortfolio(member)}
                      className="px-3 py-1 text-[10px] font-bold uppercase text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      Portfolio
                    </button>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${
                      member.role === 'owner' ? 'bg-blue-100 text-blue-600' : 
                      member.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {member.role === 'owner' ? 'EGA' : member.role === 'admin' ? 'ADMIN' : "A'ZO"}
                    </span>
                    {profile?.role === 'owner' && member.role !== 'owner' && (
                      <select 
                        value={member.role}
                        onChange={(e) => onSetRole(member.uid, e.target.value as any)}
                        className="bg-white border border-slate-200 text-[10px] font-bold rounded-lg px-2 py-1 outline-none focus:border-blue-500 shadow-sm"
                      >
                        <option value="member">A'ZO</option>
                        <option value="admin">ADMIN</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest font-mono">Faol Vazifalar</h3>
              {(profile?.role === 'owner' || profile?.role === 'admin') && (
                <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors">
                  <Plus className="w-4 h-4" /> Yangi Vazifa
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3">
              {tasks.map(task => (
                <div key={task.id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-bold uppercase tracking-tight">{task.title}</div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                      task.status === 'verified' ? 'bg-green-100 text-green-600' : 
                      task.status === 'signed_off' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {task.status === 'pending' ? 'KUTILMOQDA' : task.status === 'signed_off' ? 'BAJARILDI' : 'TASDIQLANDI'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{task.description}</p>
                  <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[8px] font-bold">
                        {teamMembers.find(m => m.uid === task.assigneeId)?.displayName.slice(0, 1)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{teamMembers.find(m => m.uid === task.assigneeId)?.displayName}</span>
                    </div>
                    {task.status !== 'verified' && (
                      <div className="flex gap-2">
                        {task.status === 'pending' && profile?.uid === task.assigneeId && (
                          <button 
                            onClick={() => updateTaskStatus(task.id, 'signed_off')}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-[8px] font-bold uppercase hover:bg-blue-700"
                          >
                            Imzolash
                          </button>
                        )}
                        {task.status === 'signed_off' && (profile?.role === 'owner' || profile?.role === 'admin') && (
                          <button 
                            onClick={() => updateTaskStatus(task.id, 'verified')}
                            className="bg-green-600 text-white px-3 py-1 rounded text-[8px] font-bold uppercase hover:bg-green-700"
                          >
                            Tasdiqlash
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SupportChat({ messages, user, profile, onSendMessage }: { 
  messages: SupportMessage[]; 
  user: FirebaseUser; 
  profile: UserProfile | null;
  onSendMessage: (msg: any) => Promise<void>;
}) {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    await onSendMessage({
      senderId: user.uid,
      senderName: profile?.displayName || user.displayName || 'Anonim Tugun',
      text: inputText,
      isAdmin: profile?.role === 'owner' || profile?.role === 'admin'
    });
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="bg-slate-900 p-4 text-white flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest">Nexus Qo'llab-quvvatlash</div>
            <div className="text-[8px] font-mono text-blue-400 animate-pulse uppercase">Bosh muhandislar onlayn</div>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sessiya Boshlandi</p>
            <p className="text-[10px] text-slate-400 mt-2">Bosh muhandislar bilan bog'lanish. Sizga qanday yordam bera olamiz?</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs ${
              msg.senderId === user.uid 
                ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-100' 
                : 'bg-white text-slate-900 border border-slate-100 rounded-tl-none shadow-sm'
            }`}>
              {msg.text}
            </div>
            <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 px-1">
              {msg.senderName} • {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString() : 'Kutilmoqda'}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white shadow-xl">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Xavfsiz xabar..."
            className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs focus:outline-none focus:border-blue-500 transition-all font-medium"
          />
          <button 
            type="submit"
            className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function ServiceRequestForm({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    customerName: '',
    customerContact: '',
    projectType: 'web' as any,
    description: '',
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Loyihani <span className="text-blue-600">Boshlash</span></h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 font-mono text-center">Bog'lanish: @mr1s_tuyginov | +998950097129</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">To'liq ism / Tashkilot</label>
          <input 
            type="text" 
            value={formData.customerName}
            onChange={e => setFormData({...formData, customerName: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none" 
            placeholder="Ismingizni kiriting"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Bog'lanish usuli (Telegram/Telefon)</label>
          <input 
            type="text" 
            value={formData.customerContact}
            onChange={e => setFormData({...formData, customerContact: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none" 
            placeholder="@alias yoki +998..."
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Strategik maqsad (Loyiha turi)</label>
          <select 
            value={formData.projectType}
            onChange={e => setFormData({...formData, projectType: e.target.value as any})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none"
          >
            <option value="web">Veb Ilova / SEO</option>
            <option value="apk">Mobil Ilova (Android/APK)</option>
            <option value="bot">Maxsus Telegram Bot</option>
            <option value="infra">Backend / Infratuzilma</option>
            <option value="other">Umumiy muhandislik</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Missiya parametrlari (Tavsif)</label>
          <textarea 
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none h-24" 
            placeholder="Maqsadingizni tushuntiring..."
          />
        </div>
      </div>

      <button 
        onClick={() => onSubmit(formData)}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4" /> So'rovni yuborish
      </button>
    </div>
  );
}

function ProductForm({ initialData, onSubmit, onCancel }: {
  initialData?: Product;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    category: initialData?.category || 'Core Infrastructure',
    type: initialData?.type || 'SDK',
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold">{initialData?.id !== 'new' ? 'Aktivni yangilash' : 'Yangi bozor aktivi'}</h2>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 font-mono">Aktiv meta-ma'lumotlarini sozlash</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Aktiv Nomi</label>
          <input 
            type="text" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500" 
            placeholder="Masalan: Enterprise Auth Core"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Turi</label>
            <select 
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            >
              <option>SDK</option>
              <option>Template</option>
              <option>Service</option>
              <option>Library</option>
              <option>Database</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Kategoriyasi</label>
            <select 
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
            >
              <option value="Core Infrastructure">Asosiy infratuzilma</option>
              <option value="Authentication SDKs">Autentifikatsiya SDK'lari</option>
              <option value="Data Orchestration">Ma'lumotlar orkestratsiyasi</option>
              <option value="Cloud Automation">Bulutli avtomatlashtirish</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Asosiy narx ($)</label>
          <input 
            type="number" 
            value={formData.price}
            onChange={e => setFormData({...formData, price: Number(e.target.value)})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block font-mono">Tavsifi</label>
          <textarea 
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 h-32" 
            placeholder="Texnik xususiyatlar..."
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-slate-100">
        <button 
          onClick={() => onSubmit(formData)}
          className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          {initialData?.id !== 'new' ? 'Yangilanishlarni saqlash' : 'Aktivni yaratish'}
        </button>
        <button 
          onClick={onCancel}
          className="px-6 py-4 border border-slate-200 rounded-xl font-bold text-slate-400 hover:bg-slate-50 uppercase tracking-widest"
        >
          Bekor qilish
        </button>
      </div>
    </div>
  );
}

function PortfolioDetails({ member, onClose }: { member: UserProfile; onClose: () => void }) {
  const details = [
    { icon: Briefcase, label: 'Mutaxassislik', value: member.specialization || 'Umumiy muhandis' },
    { icon: Award, label: 'Tajriba', value: member.experience || '3+ Yil' },
    { icon: GraduationCap, label: "Ta'lim", value: member.education || "Oliy ma'lumot" },
    { icon: Zap, label: 'Asosiy stek', value: member.skills?.join(', ') || 'React, Node, Firebase' },
    { icon: Github, label: 'Repozitoriy', value: member.github || 'github.com/nexusdev' },
    { icon: MessageSquare, label: 'Telegram', value: member.telegram || '@mr1s_tuyginov' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-6">
        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold shadow-2xl shadow-blue-200">
          {member.displayName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{member.displayName}</h2>
          <p className="text-sm text-blue-600 font-bold uppercase tracking-widest mt-1 font-mono">
            {member.role === 'owner' ? 'EGA' : member.role === 'admin' ? 'ADMIN' : "A'ZO"}
          </p>
          <div className="flex gap-2 mt-4">
            <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500">Tugun v4.0.2</span>
            <span className="px-3 py-1 bg-green-100 rounded-full text-[10px] font-bold uppercase tracking-widest text-green-600">Faol</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 italic text-slate-600 leading-relaxed text-sm">
        "{member.bio || 'Yuqori samarali muhandislik modullari va kengaytiriladigan infratuzilma yechimlari orqali kelajakni qurish.'}"
      </div>

      <div className="grid grid-cols-2 gap-4">
        {details.map((d, i) => (
          <div key={i} className="flex gap-3 p-4 bg-white border border-slate-100 rounded-2xl">
            <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-blue-600 shrink-0">
              <d.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">{d.label}</div>
              <div className="text-xs font-bold text-slate-900 mt-0.5 truncate max-w-[150px]">{d.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-100 flex items-center justify-center gap-2">
          <LinkIcon className="w-4 h-4" /> Ishlarni ko'rish
        </button>
        <button onClick={onClose} className="px-8 py-4 border border-slate-200 rounded-2xl font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50">
          Yopish
        </button>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="h-10 border-t border-slate-200 bg-white px-8 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] z-20 shrink-0 font-mono">
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
          TIZIMLAR OPTIMAL
        </div>
        <div>KUCHLANISH: 14ms</div>
        <div className="hidden sm:block">HUDUD: GLOBAL-NODE-S1</div>
      </div>
      <div className="flex gap-6">
        <div className="hidden md:block">© 2026 NEXUS DEV ARXITEKTURASI.</div>
        <div className="text-blue-500 cursor-pointer hover:text-blue-700 transition-colors">API_HUJJATLARI</div>
      </div>
    </footer>
  );
}
