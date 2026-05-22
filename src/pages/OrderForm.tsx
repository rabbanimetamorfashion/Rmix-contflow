import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { format, addDays } from 'date-fns';
import { Job, Board } from '../types';
import { ShoppingCart, Sparkles, AlertCircle, Calendar, HelpCircle, ArrowRight } from 'lucide-react';
import { BRANDS } from '../constants';

export const JOB_TYPES = [
  { id: 'voucher', label: 'Voucher' },
  { id: 'poster_a3_a4', label: 'Poster A3/A4' },
  { id: 'flyer_a5', label: 'Flyer A5' },
  { id: 'flyer_a6', label: 'Flyer A6' },
  { id: 'blash_3_4', label: 'Blash 3;4' },
  { id: 'blash_15_9', label: 'Blash 15;9' },
  { id: 'katalog', label: 'Katalog' },
  { id: 'x_banner', label: 'X Banner' },
  { id: 'video_reels_organik', label: 'Video Reels Organik' },
  { id: 'video_youtube', label: 'Video Youtube' },
  { id: 'video_ads', label: 'Video Ads' },
  { id: 'carousel_post_ads', label: 'Carousel post Ads' },
  { id: 'carousel_post_organik', label: 'Carousel post organik' },
  { id: 'square_post_ads', label: 'Square post ads' },
  { id: 'square_post_organik', label: 'Square post organik' },
  { id: 'portrait_story_sosmed', label: 'Portrait story sosmed' },
  { id: 'paket_cta_video_4_ukuran', label: 'Paket CTA video ( 4 ukuran )' },
  { id: 'audioline', label: 'Audioline' },
  { id: 'ooh_spanduk_baligho', label: 'OOH ( spanduk, baligho )' },
  { id: 'window_display_sticker', label: 'Window display sticker' },
  { id: 'pintu_store', label: 'Pintu Store' },
  { id: 'pov', label: 'Pov' },
  { id: 'wobbler', label: 'Wobbler' },
  { id: 'sign_system_store', label: 'Sign system store' },
  { id: 'backdrop', label: 'Backdrop' },
  { id: 'banner_shopee', label: 'Banner shopee' },
  { id: 'cover_video', label: 'Cover video' },
  { id: 'overlay', label: 'Overlay' },
  { id: 'lowerthird', label: 'Lowerthird' },
  { id: 'icon', label: 'Icon' },
  { id: 'banner_tiktok', label: 'Banner tiktok' },
  { id: 'banner_kitalog', label: 'Banner kitalog' },
  { id: 'cover_katalog', label: 'Cover katalog' },
  { id: 'photoshoot', label: 'Photoshoot' },
  { id: 'video_shoot', label: 'Video shoot' },
  { id: 'bumper_still', label: 'Bumper still' },
  { id: 'simbolis_hadiah', label: 'Simbolis hadiah' },
  { id: 'sertifikat', label: 'Sertifikat' },
  { id: 'id_card', label: 'Id card' },
  { id: 'event_documentation', label: 'Event documentation' },
  { id: 'video_story', label: 'Video Story' },
  { id: 'banner_digital_facebook_youtube', label: 'Banner digital facebook, youtube' },
  { id: 'photo_profile', label: 'Photo Profile' },
  { id: 'motion_graphic', label: 'Motion Graphic' },
  { id: 'twibbon', label: 'Twibbon' },
  { id: 'marketplace_produk_photo', label: 'marketplace produk photo' },
].sort((a, b) => a.label.localeCompare(b.label));

export function OrderForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [jobType, setJobType] = useState(JOB_TYPES[0].id);
  const [quantity, setQuantity] = useState<number>(1);
  const [jobTitle, setJobTitle] = useState('');
  const [brands, setBrands] = useState<string[]>([BRANDS[0]]);
  const [campaign, setCampaign] = useState('');
  const [description, setDescription] = useState('');
  const [scriptLink, setScriptLink] = useState('');
  
  const [saving, setSaving] = useState(false);

  // Default to D+3
  const [requestedDeadline, setRequestedDeadline] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));

  // Custom Boards state
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('main');

  React.useEffect(() => {
    const fetchBoards = async () => {
      try {
        const q = query(collection(db, 'boards'), orderBy('createdAt', 'asc'));
        const snap = await getDocs(q);
        setBoards(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Board)));
      } catch (err) {
        console.error("Failed to load custom boards:", err);
      }
    };
    fetchBoards();
  }, []);

  // Quick Start templates - auto-fills forms instantly! Extremely helpful for clients!
  const applyPresetTemplate = (type: 'video_reel' | 'store_launch' | 'carousel_ads' | 'print_flyer') => {
    const dPlus3 = format(addDays(new Date(), 3), 'yyyy-MM-dd');
    const dPlus5 = format(addDays(new Date(), 5), 'yyyy-MM-dd');
    
    switch(type) {
      case 'video_reel':
        setJobTitle('Premium Reels Bundle - Promo TikTok & IG');
        setJobType('video_reels_organik');
        setQuantity(3);
        setCampaign('Social Growth Q2');
        setRequestedDeadline(dPlus5);
        setDescription(`🎥 Premium Video Reels Package (Quantity x3)\n\nGoal:\nCreate 3 engaging high-converting portrait video reels for our main accounts.\n\nSpecs:\n- Resolution: 1080x1920 (9:16 portrait)\n- Fast-paced typography highlights\n- Focus on product hooks in the first 3 seconds\n- Sound sync to popular trending templates`);
        setScriptLink('https://docs.google.com/document/d/example-reels-script');
        break;
        
      case 'store_launch':
        setJobTitle('Grand Store Opening Banner Display Set');
        setJobType('x_banner');
        setQuantity(2);
        setCampaign('Grand Outlet Opening');
        setRequestedDeadline(dPlus3);
        setDescription(`🛍️ Grand Store Opening Promotional Banners (Quantity x2)\n\nGoal:\nDesigns print-ready X-banners for outside the store entrance.\n\nSpecs:\n- Banner Sizes: 60x160cm\n- Font Hierarchy: Must state "GRAND OUTLET ENTRANCE" in clean display typeface\n- Include: Google Maps QR Code, 20% discount coupon badge, and warm store photography placeholders`);
        setScriptLink('');
        break;
        
      case 'carousel_ads':
        setJobTitle('Carousel Swipe Ad Campaign - Main Benefits');
        setJobType('carousel_post_ads');
        setQuantity(4);
        setCampaign('Q2 Paid Ads Acquisition');
        setRequestedDeadline(dPlus5);
        setDescription(`📊 High-converting swipeable carousel ad card bundle (Quantity x4 cards)\n\nGoal:\nExplain the core value proposition of our brand in a bite-sized visual guide.\n\nCard Breakdown:\n- Card 1: Main hook statement\n- Card 2: Pain-point illustration (The Before state)\n- Card 3: Our solution features grid (The After state)\n- Card 4: Actionable promotional coupon code + CTA arrow`);
        setScriptLink('https://docs.google.com/presentation/d/example-brief');
        break;
        
      case 'print_flyer':
        setJobTitle('Seasonal Discount Distribution Flyer');
        setJobType('flyer_a5');
        setQuantity(1);
        setCampaign('Ramadhan Special Promo');
        setRequestedDeadline(dPlus3);
        setDescription(`🎨 Single page double-sided customer distribution flyer\n\nGoal:\nTo distribute in local neighborhoods near branches to invite walk-ins.\n\nSpecs:\n- Size: Standard A5\n- Mode: High-resolution CMYK print-ready artboard`);
        setScriptLink('');
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    try {
      if (brands.length === 0) {
        alert("Please select at least one brand.");
        setSaving(false);
        return;
      }

      if (!jobTitle.trim()) {
        alert("Please provide a Job Title.");
        setSaving(false);
        return;
      }

      const typeLabel = JOB_TYPES.find(t => t.id === jobType)?.label || jobType;

      const newJob: Job = {
        title: jobTitle,
        description,
        status: 'open',
        progress: 0,
        createdAt: Date.now(),
        creatorId: user.uid,
        jobType,
        quantity,
        brand: brands,
        campaign,
        requestedDeadline: new Date(requestedDeadline).getTime(),
        boardId: selectedBoardId,
        ...(scriptLink && { scriptLink }),
      };

      await addDoc(collection(db, 'jobs'), newJob);
      
      // Notify admins
      const qAdmins = query(collection(db, 'users'), where('role', 'in', ['admin', 'master_admin']));
      const adminDocs = await getDocs(qAdmins);
      adminDocs.forEach(docSnap => {
        addDoc(collection(db, 'notifications'), {
          userId: docSnap.id,
          message: `New Order Request: ${jobTitle}`,
          read: false,
          createdAt: Date.now(),
          type: 'new_order'
        });
      });
      
      navigate('/jobs');
      
    } catch (err) {
      console.error(err);
      alert('Failed to submit order request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col space-y-7 text-[#221B18] antialiased">
      
      {/* Page Title */}
      <header className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-[#EBE6DE] shadow-sm">
        <div className="h-12 w-12 rounded-xl bg-[#C2593E] text-white flex items-center justify-center shadow-md">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-black tracking-tight text-[#221B18]">New Brief Request</h1>
          <p className="text-slate-500 text-xs font-semibold mt-0.5">Submit your creative specs & deadlines directly to our editors.</p>
        </div>
      </header>

      {/* QUICK PRESET BRONZE TICKETS (Fills the form in 1-click!) */}
      <div className="bg-[#FAF6F0] rounded-2xl border border-[#EBE6DE] p-5 space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#8C6A5C] uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-[#C2593E]" />
          <span>Quickstart Project Presets • Auto-complete Forms:</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            type="button"
            onClick={() => applyPresetTemplate('video_reel')}
            className="p-3 bg-white hover:bg-[#FAF6F0] border border-[#EBE6DE] hover:border-[#C2593E] rounded-xl text-left transition-all text-xs font-bold space-y-1.5 shadow-xs cursor-pointer group"
          >
            <div className="text-[#C2593E] group-hover:underline">📽️ Viral Reels Bundle</div>
            <div className="text-[10px] text-slate-400 font-medium">3x video reels, vertical, fast templates</div>
          </button>
          
          <button 
            type="button"
            onClick={() => applyPresetTemplate('store_launch')}
            className="p-3 bg-white hover:bg-[#FAF6F0] border border-[#EBE6DE] hover:border-[#C2593E] rounded-xl text-left transition-all text-xs font-bold space-y-1.5 shadow-xs cursor-pointer group"
          >
            <div className="text-[#C2593E] group-hover:underline">🛍️ Store Launch Kit</div>
            <div className="text-[10px] text-slate-400 font-medium">2x X-Banners, layout sizes, Grand Opening</div>
          </button>

          <button 
            type="button"
            onClick={() => applyPresetTemplate('carousel_ads')}
            className="p-3 bg-white hover:bg-[#FAF6F0] border border-[#EBE6DE] hover:border-[#C2593E] rounded-xl text-left transition-all text-xs font-bold space-y-1.5 shadow-xs cursor-pointer group"
          >
            <div className="text-[#C2593E] group-hover:underline">📊 Carousel Swipe Ads</div>
            <div className="text-[10px] text-slate-400 font-medium font-semibold">4x slides carousel brief and hooks</div>
          </button>

          <button 
            type="button"
            onClick={() => applyPresetTemplate('print_flyer')}
            className="p-3 bg-white hover:bg-[#FAF6F0] border border-[#EBE6DE] hover:border-[#C2593E] rounded-xl text-left transition-all text-xs font-bold space-y-1.5 shadow-xs cursor-pointer group"
          >
            <div className="text-[#C2593E] group-hover:underline">🎨 Elegant Promo Flyer</div>
            <div className="text-[10px] text-slate-400 font-medium">Standard A5 print-ready promotion sheet</div>
          </button>
        </div>
      </div>

      <motion.form 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit} 
        className="bg-white rounded-2xl shadow-sm border border-[#EBE6DE] p-6 lg:p-8 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Form left inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Job Title</label>
              <input
                type="text"
                required
                value={jobTitle}
                onChange={e => setJobTitle(e.target.value)}
                placeholder="ex: Ramadhan 2026 Poster Layout"
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Job Type</label>
                <select
                  value={jobType}
                  onChange={e => setJobType(e.target.value)}
                  className="w-full text-xs px-3 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-bold text-slate-700 cursor-pointer"
                >
                  {JOB_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={e => setQuantity(Number(e.target.value))}
                  className="w-full text-xs px-3 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-bold text-slate-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Target Job Board</label>
                <select
                  value={selectedBoardId}
                  onChange={e => setSelectedBoardId(e.target.value)}
                  className="w-full text-xs px-3 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-bold text-slate-700 cursor-pointer"
                >
                  <option value="main">Main Board</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id!}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Requested Target Date</label>
                <input
                  type="date"
                  required
                  value={requestedDeadline}
                  onChange={e => setRequestedDeadline(e.target.value)}
                  className="w-full text-xs px-3 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-bold text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Campaign Label</label>
              <input
                type="text"
                required
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                placeholder="ex: Summer Sale Special Campaign"
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E]"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Docs / Script brief link (Optional)</label>
              <input
                type="url"
                value={scriptLink}
                onChange={e => setScriptLink(e.target.value)}
                placeholder="https://docs.google.com/document/..."
                className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E]"
              />
            </div>
          </div>

          {/* Brands right checklist list */}
          <div className="space-y-4">
            <div className="h-full flex flex-col">
              <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Associated Brands (Select multiples if collab)</label>
              <div className="flex flex-col gap-1.5 border border-[#EBE6DE] p-3 rounded-2xl bg-[#FAF6F0]/30 flex-1 overflow-y-auto max-h-[19.5rem] min-h-[14rem]">
                {BRANDS.map(b => (
                  <label key={b} className="flex items-center gap-2.5 cursor-pointer p-2 hover:bg-white rounded-xl transition-colors border border-transparent hover:border-[#EBE6DE]/50">
                    <input
                      type="checkbox"
                      className="rounded text-[#C2593E] focus:ring-[#C2593E] w-4 h-4 cursor-pointer shrink-0"
                      checked={brands.includes(b)}
                      onChange={e => {
                        if (e.target.checked) setBrands(prev => [...prev, b]);
                        else setBrands(prev => prev.filter(brand => brand !== b));
                      }}
                    />
                    <span className="text-xs font-semibold text-slate-700">{b}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Full instructions */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-[#8C6A5C] tracking-wider mb-2">Detailed Specs & Copywriter Brief Instructions</label>
          <textarea
            required
            rows={5}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Write clear instructions. Specify delivery dimensions, copy-text, background references, theme ideas, or links to asset folders..."
            className="w-full text-xs px-3.5 py-3 border border-slate-200 rounded-xl bg-[#FAF6F0]/40 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#C2593E] font-medium leading-relaxed"
          />
        </div>

        {/* Submit action panel */}
        <div className="pt-4 border-t border-[#FAF6F0] flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3.5 text-xs font-extrabold uppercase tracking-wider text-white bg-[#C2593E] hover:bg-[#A3432A] rounded-xl disabled:opacity-50 transition w-full sm:w-auto shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{saving ? 'Transmitting Specs...' : 'Submit Order Brief'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.form>
    </div>
  );
}
