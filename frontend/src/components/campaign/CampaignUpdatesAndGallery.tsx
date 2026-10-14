import React, { useState } from 'react';
import { CAMPAIGN_UPDATES, CAMPAIGN_ASSETS } from '../../data/campaigns';
import { RefreshCw, MapPin, Calendar, Camera, X, ExternalLink } from 'lucide-react';

export const CampaignUpdatesAndGallery: React.FC = () => {
  const [activePhoto, setActivePhoto] = useState<string | null>(null);

  const galleryImages = [
    {
      src: CAMPAIGN_ASSETS.heroRescue,
      title: 'Emergency Rescuer Feeding Injured Gaumata',
      desc: 'First moments after stabilized extraction on Rishikesh highway'
    },
    {
      src: CAMPAIGN_ASSETS.stories.story1,
      title: 'Roadside Trauma Extraction',
      desc: 'Careful loading onto our customized hydraulic rescue vehicle'
    },
    {
      src: CAMPAIGN_ASSETS.stories.story2,
      title: 'Veterinary Trauma Flush & Saline Drips',
      desc: 'Removing deep tissue maggots and administering antimicrobial wash'
    },
    {
      src: CAMPAIGN_ASSETS.stories.story3,
      title: 'Peaceful Recovery in Sanctuary',
      desc: 'Resting comfortably on fresh dry hay and clean straw bedding'
    }
  ];

  return (
    <section id="updates" className="py-12 sm:py-16 bg-[#FDFBF7] border-b border-[#EAE5DD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9F3D00] bg-amber-50 px-3 py-1 rounded-md mb-3 border border-amber-200">
            <RefreshCw className="w-3.5 h-3.5" />
            Field Updates &amp; Visual Proof
          </div>
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F2942]">
            Live Campaign Updates &amp; Evidence
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Direct dispatches from our veterinary team at the Rishikesh sanctuary documenting the exact care your donations fund.
          </p>
        </div>

        {/* Updates Timeline List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
          {CAMPAIGN_UPDATES.map((update) => (
            <div
              key={update.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-md">
                    {update.tag}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    {update.date}
                  </span>
                </div>

                <h3 className="font-display font-bold text-lg text-[#0F2942] mb-2">
                  {update.title}
                </h3>

                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  {update.description}
                </p>
              </div>

              {update.image && (
                <div
                  onClick={() => setActivePhoto(update.image!)}
                  className="relative rounded-xl overflow-hidden aspect-16/9 bg-slate-100 cursor-pointer group"
                >
                  <img
                    src={update.image}
                    alt={update.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <span className="bg-black/60 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-xs flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" /> View Photo
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-500 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#9F3D00]" />
                <span>{update.location}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Proof Photo Gallery */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-bold text-xl text-[#0F2942]">
                Rescue Sanctuary Photo Evidence
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Click any image to view in high definition
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {galleryImages.map((img, index) => (
              <div
                key={index}
                onClick={() => setActivePhoto(img.src)}
                className="group relative rounded-2xl overflow-hidden aspect-square bg-slate-200 border border-slate-200 cursor-pointer shadow-xs hover:shadow-md"
              >
                <img
                  src={img.src}
                  alt={img.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end text-white">
                  <p className="text-xs font-bold leading-tight">{img.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Lightbox Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-4xl w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={activePhoto}
              alt="High resolution rescue documentation"
              className="w-full max-h-[80vh] object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </section>
  );
};
