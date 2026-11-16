# 🛍️ Catalyst's Corner Shopify Theme

A stunning dark cyberpunk Shopify theme designed for **Catalyst's Corner** - the official NovAura store. Features RGB neon accents, glassmorphism effects, and smooth animations.

![Theme Preview](theme-preview.jpg)

## ✨ Features

- **Dark Cyberpunk Aesthetic** - Deep void backgrounds with neon magenta, cyan, and lime accents
- **Animated Hero Section** - Floating badges, gradient text effects, animated grid background
- **Product Cards** - Hover effects with RGB glow, quick add to cart, sale badges
- **Glassmorphism Header** - Sticky header with blur backdrop effect
- **Responsive Grid** - 1-4 column adaptive product grid
- **Smooth Animations** - Scroll reveals, staggered loading, micro-interactions
- **Custom Scrollbar** - Themed to match the dark aesthetic
- **SEO Optimized** - Meta tags, structured data, semantic HTML

## 🚀 Installation

### Method 1: Shopify CLI (Recommended)

1. **Install Shopify CLI** (if not already installed):
   ```bash
   npm install -g @shopify/cli @shopify/theme
   ```

2. **Navigate to the theme folder**:
   ```bash
   cd NovAura-Unified/shopify-theme
   ```

3. **Login to your Shopify store**:
   ```bash
   shopify auth login --store catalysts-corner.myshopify.com
   ```

4. **Push the theme to your store**:
   ```bash
   shopify theme push --theme Catalysts-Corner-NovAura
   ```

5. **Or serve locally for development**:
   ```bash
   shopify theme dev --store catalysts-corner.myshopify.com
   ```

### Method 2: Manual Upload

1. **Zip the theme folder** (excluding this README and any development files)
2. Go to **Shopify Admin** → **Online Store** → **Themes**
3. Click **Add theme** → **Upload zip file**
4. Select the zipped theme file
5. Click **Publish** when ready

### Method 3: GitHub Integration

1. Push this theme to a GitHub repository
2. In Shopify Admin, go to **Online Store** → **Themes**
3. Click **Add theme** → **Connect from GitHub**
4. Select your repository and branch

## ⚙️ Configuration

### Storefront API Access

To enable the headless integration with NovAura, make sure your Storefront API is configured:

1. Go to **Settings** → **Apps and sales channels** → **Develop apps**
2. Create a new private app or edit existing
3. Enable **Storefront API access**
4. Copy the **Storefront access token** to your NovAura `.env`:
   ```
   VITE_SHOPIFY_STOREFRONT_TOKEN=your_token_here
   ```

### Theme Customization

1. Go to **Online Store** → **Themes** → **Customize**
2. Edit sections:
   - **Hero** - Main banner with gradient text
   - **Product Grid** - Featured products display
   - **Header** - Navigation and logo
   - **Footer** - Links and social media

### Color System

The theme uses CSS custom properties for easy customization:

```css
--color-void: #0a0a0f;           /* Main background */
--color-void-light: #12121a;     /* Card backgrounds */
--color-neon-cyan: #00f5d4;      /* Accent cyan */
--color-neon-magenta: #ff006e;   /* Accent magenta */
--color-neon-lime: #39ff14;      /* Prices/highlights */
```

Edit these in **Theme Settings** → **Colors**

## 📁 File Structure

```
shopify-theme/
├── layout/
│   └── theme.liquid          # Main layout with CSS variables
├── templates/
│   └── index.json            # Homepage template
├── sections/
│   ├── novaura-hero.liquid       # Hero section
│   ├── novaura-product-grid.liquid # Product grid
│   ├── novaura-header.liquid     # Header navigation
│   ├── novaura-footer.liquid     # Footer
│   ├── novaura-announcement.liquid # Announcement bar
│   ├── header-group.json         # Header section group
│   └── footer-group.json         # Footer section group
├── snippets/
│   ├── meta-tags.liquid          # SEO meta tags
│   └── novaura-animations.liquid # CSS animations
├── assets/
│   ├── novaura-theme.css         # Main theme styles
│   ├── base.css                  # Shopify base styles
│   ├── constants.js              # Theme constants
│   ├── pubsub.js                 # Event pub/sub
│   └── global.js                 # Global scripts
├── config/
│   └── settings_schema.json      # Theme settings
└── locales/
    └── en.default.json           # English translations
```

## 🔗 Integration with NovAura

This theme is designed to work seamlessly with the NovAura platform's headless Shopify integration:

- Products fetched via Storefront API
- Cart sync between NovAura and Shopify
- Shared branding and design system
- Unified checkout experience

## 📝 Notes

- The Storefront Access Token found in `.env` is **public** and safe for frontend use
- For production, regenerate the token in Shopify Admin if needed
- Ensure products have images for best display
- Collections should be set up before assigning to sections

## 🎨 Credits

- **Design System**: NovAura Platform
- **Theme Author**: Kimi Code CLI
- **Store**: Catalyst's Corner
- **Framework**: Shopify Online Store 2.0

## 📞 Support

For theme customization or issues:
- Shopify Help Center: https://help.shopify.com
- NovAura Support: support@catalystscorner.com

---

**Built with 💜 for the NovAura Ecosystem**
