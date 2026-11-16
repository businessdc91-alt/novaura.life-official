import { motion } from 'framer-motion';
import { 
  Edit3 as Edit3Icon, 
  Save as SaveIcon, 
  Globe as GlobeIcon, 
  Layout as LayoutIcon, 
  Code as CodeIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SiteContent {
  homepage: {
    heroTitle: string;
    heroSubtitle: string;
  };
  about: {
    content: string;
  };
  footer: {
    copyright: string;
  };
}

interface SiteContentEditorProps {
  siteContent: SiteContent;
  editedContent: SiteContent;
  editingContent: boolean;
  setEditingContent: (value: boolean) => void;
  setEditedContent: (content: SiteContent) => void;
  handleSaveContent: () => void;
}

export const SiteContentEditor = ({
  siteContent,
  editedContent,
  editingContent,
  setEditingContent,
  setEditedContent,
  handleSaveContent
}: SiteContentEditorProps) => {
  return (
    <motion.div
      key="content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="bg-void-light border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-xl font-bold text-text-primary">
            Site Content Editor
          </h3>
          {!editingContent ? (
            <Button
              onClick={() => setEditingContent(true)}
              className="bg-neon-cyan text-void font-bold"
            >
              <Edit3Icon className="w-4 h-4 mr-2" />
              Edit Content
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingContent(false);
                  setEditedContent(siteContent);
                }}
                className="border-white/20"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveContent}
                className="bg-gradient-rgb text-void font-bold"
              >
                <SaveIcon className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Homepage Content */}
          <div className="border border-white/10 rounded-lg p-4">
            <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
              <GlobeIcon className="w-4 h-4 text-neon-cyan" />
              Homepage
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-muted mb-2">Hero Title</label>
                {editingContent ? (
                  <Input
                    value={editedContent.homepage.heroTitle}
                    onChange={(e) => setEditedContent({
                      ...editedContent,
                      homepage: { ...editedContent.homepage, heroTitle: e.target.value }
                    })}
                    className="bg-void border-white/10"
                  />
                ) : (
                  <p className="text-text-primary bg-void p-3 rounded-lg">{siteContent.homepage.heroTitle}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-2">Hero Subtitle</label>
                {editingContent ? (
                  <Textarea
                    value={editedContent.homepage.heroSubtitle}
                    onChange={(e) => setEditedContent({
                      ...editedContent,
                      homepage: { ...editedContent.homepage, heroSubtitle: e.target.value }
                    })}
                    className="bg-void border-white/10"
                    rows={2}
                  />
                ) : (
                  <p className="text-text-primary bg-void p-3 rounded-lg">{siteContent.homepage.heroSubtitle}</p>
                )}
              </div>
            </div>
          </div>

          {/* About Content */}
          <div className="border border-white/10 rounded-lg p-4">
            <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
              <LayoutIcon className="w-4 h-4 text-neon-violet" />
              About Page
            </h4>
            <div>
              <label className="block text-sm text-text-muted mb-2">Content</label>
              {editingContent ? (
                <Textarea
                  value={editedContent.about.content}
                  onChange={(e) => setEditedContent({
                    ...editedContent,
                    about: { ...editedContent.about, content: e.target.value }
                  })}
                  className="bg-void border-white/10"
                  rows={4}
                />
              ) : (
                <p className="text-text-primary bg-void p-3 rounded-lg">{siteContent.about.content}</p>
              )}
            </div>
          </div>

          {/* Footer Content */}
          <div className="border border-white/10 rounded-lg p-4">
            <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
              <CodeIcon className="w-4 h-4 text-neon-lime" />
              Footer
            </h4>
            <div>
              <label className="block text-sm text-text-muted mb-2">Copyright Text</label>
              {editingContent ? (
                <Input
                  value={editedContent.footer.copyright}
                  onChange={(e) => setEditedContent({
                    ...editedContent,
                    footer: { ...editedContent.footer, copyright: e.target.value }
                  })}
                  className="bg-void border-white/10"
                />
              ) : (
                <p className="text-text-primary bg-void p-3 rounded-lg">{siteContent.footer.copyright}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
