import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { format, addDays } from 'date-fns';
import { Job } from '../types';
import { ShoppingCart } from 'lucide-react';
import { BRANDS } from '../constants';

const JOB_TYPES = [
  { id: 'voucher', label: 'Voucher' },
  { id: 'poster_a3_a4', label: 'Poster A3/A4' },
  { id: 'flyer_a5', label: 'Flyer A5' },
  { id: 'flyer_a6', label: 'Flyer A6' },
  { id: 'blash_3_4', label: 'Blash 3;4' },
  { id: 'blash_15_9', label: 'Blash 15;9' },
  { id: 'katalog', label: 'Katalog' },
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
];

export function OrderForm() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [jobType, setJobType] = useState(JOB_TYPES[0].id);
  const [quantity, setQuantity] = useState<number>(1);
  const [brand, setBrand] = useState(BRANDS[0]);
  const [campaign, setCampaign] = useState('');
  const [description, setDescription] = useState('');
  const [scriptLink, setScriptLink] = useState('');
  
  const [saving, setSaving] = useState(false);

  // Default to D+3
  const [requestedDeadline, setRequestedDeadline] = useState(format(addDays(new Date(), 3), 'yyyy-MM-dd'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setSaving(true);
    try {
      const typeLabel = JOB_TYPES.find(t => t.id === jobType)?.label || jobType;
      const title = `${typeLabel} - ${brand} (${campaign})`;

      const newJob: Job = {
        title,
        description,
        status: 'open',
        progress: 0,
        createdAt: Date.now(),
        creatorId: user.uid,
        jobType,
        quantity,
        brand,
        campaign,
        requestedDeadline: new Date(requestedDeadline).getTime(),
        ...(scriptLink && { scriptLink }),
      };

      await addDoc(collection(db, 'jobs'), newJob);
      
      // Notify admins and master_admins
      const qAdmins = query(collection(db, 'users'), where('role', 'in', ['admin', 'master_admin']));
      const adminDocs = await getDocs(qAdmins);
      adminDocs.forEach(docSnap => {
        addDoc(collection(db, 'notifications'), {
          userId: docSnap.id,
          message: `New Order Request: ${title}`,
          read: false,
          createdAt: Date.now(),
          type: 'new_order'
        });
      });
      
      // For now we just go back to job board where they can see their order
      navigate('/jobs');
      
    } catch (err) {
      console.error(err);
      alert('Failed to submit order request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col space-y-6 text-slate-800">
      <header className="flex items-center gap-4">
        <ShoppingCart className="w-8 h-8 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">New Order Request</h1>
          <p className="text-slate-500 text-sm mt-1">Submit a new job order to the creative production team.</p>
        </div>
      </header>

      <motion.form 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleSubmit} 
        className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Job Type</label>
              <select
                value={jobType}
                onChange={e => setJobType(e.target.value)}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {JOB_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Quantity / How Much</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Suggested Deadline</label>
              <input
                type="date"
                required
                value={requestedDeadline}
                onChange={e => setRequestedDeadline(e.target.value)}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Brand</label>
              <select
                required
                value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {BRANDS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Campaign Name</label>
              <input
                type="text"
                required
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                placeholder="ex: Summer Sale 2024"
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Docs / Script Link (Optional)</label>
              <input
                type="url"
                value={scriptLink}
                onChange={e => setScriptLink(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Detailed Instructions</label>
          <textarea
            required
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Provide specific sizes, references, or links to assets..."
            className="w-full text-sm px-3 py-2.5 border border-slate-200 rounded-md bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition w-full sm:w-auto shadow-sm"
          >
            {saving ? 'Submitting Order...' : 'Submit Order Request'}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
