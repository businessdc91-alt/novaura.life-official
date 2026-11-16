import { motion } from 'framer-motion';
import { 
  Search as SearchIcon, 
  Package as PackageIcon, 
  FileText as FileTextIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Asset {
  id: string;
  title: string;
  thumbnailUrl?: string;
  category?: string;
  licenseTier?: string;
  creator?: {
    username: string;
  };
}

interface MarketHighlightsProps {
  filteredAssets: Asset[];
  assetSearch: string;
  setAssetSearch: (value: string) => void;
  staffPicks: string[];
  setStaffPicks: (ids: string[]) => void;
  paidPromotions: string[];
  setPaidPromotions: (ids: string[]) => void;
}

export const MarketHighlights = ({
  filteredAssets,
  assetSearch,
  setAssetSearch,
  staffPicks,
  setStaffPicks,
  paidPromotions,
  setPaidPromotions
}: MarketHighlightsProps) => {
  return (
    <motion.div
      key="highlights"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="font-heading text-xl font-bold text-text-primary mb-1">
              Storefront Highlights
            </h3>
            <p className="text-text-muted text-sm">Designate staff picks and paid tier advertisements for the homepage.</p>
          </div>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              type="text"
              placeholder="Search all assets..."
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              className="pl-10 py-2 bg-void border-white/10 w-64"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-20 bg-void/50 rounded-xl border border-dashed border-white/10">
              <PackageIcon className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-20" />
              <p className="text-text-muted uppercase tracking-widest text-xs font-bold">No assets found matching your search</p>
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const isStaffPick = staffPicks.includes(asset.id);
              const isPaidPromotion = paidPromotions.includes(asset.id);
              
              return (
                <div key={asset.id} className={`flex items-center gap-4 p-4 bg-void border rounded-xl transition-all ${isPaidPromotion ? 'border-neon-cyan/40 bg-neon-cyan/5' : isStaffPick ? 'border-neon-lime/40 bg-neon-lime/5' : 'border-white/5'}`}>
                  <div className="w-16 h-16 bg-void-light rounded-lg flex items-center justify-center overflow-hidden border border-white/10">
                    {asset.thumbnailUrl ? (
                      <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" />
                    ) : (
                      <FileTextIcon className="w-8 h-8 text-text-muted" />
                    )}
                  </div>
                  
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-text-primary text-lg">{asset.title}</p>
                      {isPaidPromotion && <span className="px-2 py-0.5 bg-neon-cyan text-void text-[8px] font-black uppercase tracking-widest rounded shadow-sm">Promoted</span>}
                      {isStaffPick && <span className="px-2 py-0.5 bg-neon-lime text-void text-[8px] font-black uppercase tracking-widest rounded shadow-sm">Staff Pick</span>}
                    </div>
                    <p className="text-text-muted text-xs">by {asset.creator?.username} • {asset.category} • {asset.licenseTier}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (isPaidPromotion) {
                          setPaidPromotions(paidPromotions.filter(id => id !== asset.id));
                        } else {
                          setPaidPromotions([...paidPromotions, asset.id]);
                        }
                      }}
                      className={`h-9 px-4 text-[10px] font-black border transition-all ${isPaidPromotion ? 'bg-neon-cyan text-void border-neon-cyan shadow-[0_0_15px_rgba(0,255,249,0.3)]' : 'border-white/10 text-text-muted hover:border-neon-cyan/50 hover:text-neon-cyan hover:bg-neon-cyan/5'}`}
                    >
                      {isPaidPromotion ? "REMOVE PROMO" : "MAKE PROMO"}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (isStaffPick) {
                          setStaffPicks(staffPicks.filter(id => id !== asset.id));
                        } else {
                          setStaffPicks([...staffPicks, asset.id]);
                        }
                      }}
                      className={`h-9 px-4 text-[10px] font-black border transition-all ${isStaffPick ? 'bg-neon-lime text-void border-neon-lime shadow-[0_0_15px_rgba(57,255,20,0.3)]' : 'border-white/10 text-text-muted hover:border-neon-lime/50 hover:text-neon-lime hover:bg-neon-lime/5'}`}
                    >
                      {isStaffPick ? "REMOVE PICK" : "MAKE PICK"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </motion.div>
  );
};
