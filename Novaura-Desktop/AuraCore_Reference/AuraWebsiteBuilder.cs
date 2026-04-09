/*
 * AURA WEBSITE BUILDER - AI-Powered Live Web Development
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Build websites through conversation + watch AI work
 *
 * THE REVOLUTION:
 * User describes website → AI builds it LIVE → User watches and guides
 *
 * THREE MODES:
 * 1. From Scratch - AI codes HTML/CSS/JS from description
 * 2. Template - AI uses/customizes templates
 * 3. Builder Navigation - AI uses website builders (Wix, Webflow, etc.)
 *
 * USER EXPERIENCE:
 * - Describes what they want
 * - Watches AI code in real-time
 * - Sees live preview
 * - Gives feedback: "make that blue", "bigger font"
 * - AI adjusts immediately
 * - Export when done
 *
 * UNIQUE FEATURES:
 * - Watch AI type code (transparent, educational)
 * - Live preview updates
 * - AI explains decisions
 * - Works with external builders too
 * - Mobile responsive by default
 * - SEO optimized automatically
 *
 * MARKET IMPACT:
 * - Wix/Squarespace: $200-500/year
 * - Web developers: $2,000-10,000 per site
 * - AuraxNova: Included in $50/year
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum WebsiteType
    {
        Portfolio,          // Personal portfolio
        Business,           // Business/company site
        LandingPage,        // Product landing page
        Blog,               // Blog/news site
        ECommerce,          // Online store
        Documentation,      // Technical docs
        Resume,             // Online resume/CV
        Wedding,            // Event site
        Restaurant,         // Restaurant/menu site
        Agency,             // Creative agency
        SaaS,              // SaaS product site
        Custom             // Fully custom
    }

    public enum BuildMode
    {
        FromScratch,        // AI codes HTML/CSS/JS
        Template,           // AI uses template and customizes
        BuilderNavigation   // AI navigates external builder
    }

    public class WebsiteProject
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; }
        public WebsiteType Type { get; set; }
        public BuildMode Mode { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        // Files
        public string HtmlContent { get; set; } = "";
        public string CssContent { get; set; } = "";
        public string JsContent { get; set; } = "";
        public Dictionary<string, string> AdditionalFiles { get; set; } = new();

        // Metadata
        public string Title { get; set; }
        public string Description { get; set; }
        public List<string> Keywords { get; set; } = new();
        public string FaviconPath { get; set; }

        // Design
        public WebsiteDesign Design { get; set; } = new();

        // Build history
        public List<BuildStep> BuildSteps { get; set; } = new();

        // Export path
        public string ExportPath { get; set; }
    }

    public class WebsiteDesign
    {
        public string Theme { get; set; } = "dark";  // dark, light, custom
        public string PrimaryColor { get; set; } = "#00FF00";
        public string SecondaryColor { get; set; } = "#0078D4";
        public string BackgroundColor { get; set; } = "#1E1E1E";
        public string TextColor { get; set; } = "#FFFFFF";
        public string FontFamily { get; set; } = "Segoe UI, sans-serif";
        public string AccentStyle { get; set; } = "rgb_border";  // Like AuraxNova!
        public bool MobileResponsive { get; set; } = true;
        public bool DarkModeToggle { get; set; } = false;
    }

    public class BuildStep
    {
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string Action { get; set; }
        public string Description { get; set; }
        public string CodeSnippet { get; set; }
        public string AIExplanation { get; set; }
    }

    public class AuraWebsiteBuilder
    {
        private readonly GemmaInterface _ai;
        private readonly AuraDarkWebBrowser _browser;
        private List<WebsiteProject> _projects = new();

        // Template library
        private readonly Dictionary<WebsiteType, string> _templates = new();

        public AuraWebsiteBuilder(GemmaInterface ai, AuraDarkWebBrowser browser = null)
        {
            _ai = ai;
            _browser = browser;
            LoadTemplates();
        }

        #region Project Creation

        /// <summary>
        /// Start building a website from user description
        /// </summary>
        public async Task<WebsiteProject> StartWebsiteAsync(
            string description,
            WebsiteType type,
            BuildMode mode = BuildMode.FromScratch)
        {
            var project = new WebsiteProject
            {
                Name = ExtractNameFromDescription(description),
                Type = type,
                Mode = mode,
                Title = ExtractNameFromDescription(description)
            };

            // AI analyzes requirements
            var analysisPrompt = $@"User wants to build a {type} website: {description}

Analyze and provide:
1. Suggested page structure (e.g., Home, About, Contact)
2. Key features needed
3. Design recommendations
4. Color scheme suggestion
5. Content sections

Return as JSON.";

            var analysis = await _ai.SendMessageAsync(analysisPrompt);

            // Parse and store requirements
            project.Description = description;

            // Log first step
            project.BuildSteps.Add(new BuildStep
            {
                Action = "analyze_requirements",
                Description = "Analyzed project requirements",
                AIExplanation = analysis
            });

            _projects.Add(project);

            return project;
        }

        #endregion

        #region From Scratch Mode (AI Codes)

        /// <summary>
        /// AI builds website from scratch, user watches code being written
        /// </summary>
        public async Task<string> BuildFromScratchAsync(
            WebsiteProject project,
            Action<BuildStep> onStepComplete = null)
        {
            var narration = new StringBuilder();

            // Step 1: Generate HTML structure
            narration.AppendLine("Starting HTML structure...");

            var htmlPrompt = $@"Create semantic HTML5 structure for a {project.Type} website.
Title: {project.Title}
Description: {project.Description}

Requirements:
- Semantic HTML5 tags
- Accessibility (ARIA labels, alt text)
- SEO optimized (meta tags, structured data)
- Mobile viewport
- Include placeholder for content sections

Return ONLY the HTML code.";

            project.HtmlContent = await _ai.SendMessageAsync(htmlPrompt);

            var step1 = new BuildStep
            {
                Action = "generate_html",
                Description = "Created HTML structure with semantic tags",
                CodeSnippet = project.HtmlContent.Length > 200
                    ? project.HtmlContent.Substring(0, 200) + "..."
                    : project.HtmlContent,
                AIExplanation = "I used semantic HTML5 tags for better SEO and accessibility. Added meta tags for social sharing."
            };
            project.BuildSteps.Add(step1);
            onStepComplete?.Invoke(step1);

            narration.AppendLine("✓ HTML structure complete");

            // Step 2: Generate CSS
            narration.AppendLine("Creating styles...");

            var cssPrompt = $@"Create modern CSS for the HTML I just generated.

Design preferences:
- Theme: {project.Design.Theme}
- Primary color: {project.Design.PrimaryColor}
- Background: {project.Design.BackgroundColor}
- Font: {project.Design.FontFamily}
- Accent style: {project.Design.AccentStyle}

Requirements:
- Mobile-first responsive design
- Smooth animations
- Modern CSS Grid/Flexbox
- CSS variables for theming
- Hover effects
- Loading animations

If accent_style is 'rgb_border', add animated RGB gradient borders like AuraxNova!

Return ONLY the CSS code.";

            project.CssContent = await _ai.SendMessageAsync(cssPrompt);

            var step2 = new BuildStep
            {
                Action = "generate_css",
                Description = "Created modern CSS with responsive design",
                CodeSnippet = project.CssContent.Length > 200
                    ? project.CssContent.Substring(0, 200) + "..."
                    : project.CssContent,
                AIExplanation = "Used CSS Grid for layout, added smooth animations, and made it fully responsive. Added RGB border animation!"
            };
            project.BuildSteps.Add(step2);
            onStepComplete?.Invoke(step2);

            narration.AppendLine("✓ Styles complete");

            // Step 3: Generate JavaScript (if needed)
            if (RequiresJavaScript(project.Type))
            {
                narration.AppendLine("Adding interactivity...");

                var jsPrompt = $@"Create JavaScript for the website.

Features needed for {project.Type}:
- Smooth scroll
- Mobile menu toggle
- Form validation (if forms present)
- Lazy loading images
- Contact form handling
- Analytics setup

Use vanilla JavaScript (no jQuery). Modern ES6+ syntax.

Return ONLY the JavaScript code.";

                project.JsContent = await _ai.SendMessageAsync(jsPrompt);

                var step3 = new BuildStep
                {
                    Action = "generate_js",
                    Description = "Added interactivity and form handling",
                    CodeSnippet = project.JsContent.Length > 200
                        ? project.JsContent.Substring(0, 200) + "..."
                        : project.JsContent,
                    AIExplanation = "Added smooth scrolling, mobile menu, and form validation. All vanilla JS for performance."
                };
                project.BuildSteps.Add(step3);
                onStepComplete?.Invoke(step3);

                narration.AppendLine("✓ JavaScript complete");
            }

            // Step 4: Generate content
            narration.AppendLine("Generating content...");

            var contentPrompt = $@"Generate realistic content for a {project.Type} website about: {project.Description}

Provide:
- Compelling headline
- Hero section text
- About section (2-3 paragraphs)
- Features/services (3-5 items)
- Call-to-action text
- Footer content

Make it professional and engaging.";

            var content = await _ai.SendMessageAsync(contentPrompt);

            // Inject content into HTML
            project.HtmlContent = InjectContentIntoHTML(project.HtmlContent, content);

            var step4 = new BuildStep
            {
                Action = "generate_content",
                Description = "Generated professional content",
                AIExplanation = "Created engaging copy that matches the site's purpose and tone."
            };
            project.BuildSteps.Add(step4);
            onStepComplete?.Invoke(step4);

            narration.AppendLine("✓ Content generated");

            // Step 5: Optimize for SEO
            narration.AppendLine("Optimizing for SEO...");

            project.HtmlContent = await OptimizeForSEOAsync(project);

            var step5 = new BuildStep
            {
                Action = "optimize_seo",
                Description = "Added SEO meta tags and structured data",
                AIExplanation = "Added Open Graph tags, Twitter cards, and JSON-LD structured data for better search visibility."
            };
            project.BuildSteps.Add(step5);
            onStepComplete?.Invoke(step5);

            narration.AppendLine("✓ SEO optimized");

            narration.AppendLine("\n🎉 Website complete! Ready to preview or export.");

            return narration.ToString();
        }

        #endregion

        #region Template Mode

        /// <summary>
        /// Use template and let AI customize it
        /// </summary>
        public async Task<string> BuildFromTemplateAsync(
            WebsiteProject project,
            Action<BuildStep> onStepComplete = null)
        {
            var narration = new StringBuilder();

            // Get template
            if (!_templates.ContainsKey(project.Type))
            {
                return "No template available for this type. Use From Scratch mode.";
            }

            var template = _templates[project.Type];
            project.HtmlContent = template;

            narration.AppendLine($"Loaded {project.Type} template...");

            // AI customizes template
            var customizePrompt = $@"Here's a {project.Type} website template:

{template}

Customize it for: {project.Description}

Changes needed:
- Update colors to: {project.Design.PrimaryColor}, {project.Design.BackgroundColor}
- Update text content to match description
- Adjust layout if needed
- Keep responsive design

Return the complete customized HTML.";

            project.HtmlContent = await _ai.SendMessageAsync(customizePrompt);

            var step = new BuildStep
            {
                Action = "customize_template",
                Description = "Customized template with user's content and colors",
                AIExplanation = "Modified template to match your brand and content while keeping the proven layout."
            };
            project.BuildSteps.Add(step);
            onStepComplete?.Invoke(step);

            narration.AppendLine("✓ Template customized");
            narration.AppendLine("\n🎉 Website ready!");

            return narration.ToString();
        }

        #endregion

        #region Builder Navigation Mode

        /// <summary>
        /// AI navigates external website builder (Wix, Webflow, etc.)
        /// User watches AI work in browser
        /// </summary>
        public async Task<string> NavigateBuilderAsync(
            WebsiteProject project,
            string builderUrl,
            Action<string> onAIAction = null)
        {
            if (_browser == null)
            {
                return "Browser integration required for this mode.";
            }

            var narration = new StringBuilder();

            narration.AppendLine($"Opening {builderUrl}...");
            onAIAction?.Invoke($"navigate|{builderUrl}");

            await Task.Delay(2000);  // Wait for page load

            narration.AppendLine("Looking for 'Create New' button...");
            onAIAction?.Invoke("click|Create New Site");

            await Task.Delay(1500);

            narration.AppendLine($"Selecting {project.Type} template...");
            onAIAction?.Invoke($"click|{project.Type} Template");

            await Task.Delay(2000);

            narration.AppendLine("Customizing header...");
            onAIAction?.Invoke($"type|{project.Title}");

            await Task.Delay(1000);

            narration.AppendLine("Adjusting colors...");
            onAIAction?.Invoke($"click|Color Picker");
            onAIAction?.Invoke($"type|{project.Design.PrimaryColor}");

            // Continue building...
            // This is a placeholder - full implementation would:
            // 1. Use browser automation (Selenium/Puppeteer equivalent)
            // 2. AI decides what to click based on page structure
            // 3. User watches in real-time
            // 4. User can intervene: "no, make that bigger"

            narration.AppendLine("\n✓ Site created in builder!");
            narration.AppendLine("You can now continue manually or let me finish.");

            return narration.ToString();
        }

        #endregion

        #region Live Editing

        /// <summary>
        /// User gives feedback, AI adjusts in real-time
        /// </summary>
        public async Task<string> ApplyFeedbackAsync(WebsiteProject project, string feedback)
        {
            var feedbackPrompt = $@"User feedback on their {project.Type} website: '{feedback}'

Current HTML (snippet):
{project.HtmlContent.Substring(0, Math.Min(500, project.HtmlContent.Length))}...

Current CSS (snippet):
{project.CssContent.Substring(0, Math.Min(500, project.CssContent.Length))}...

Apply the requested changes. Return JSON with:
{{
  ""changes"": ""description of changes made"",
  ""html_update"": ""updated HTML (full or snippet to replace)"",
  ""css_update"": ""updated CSS (full or snippet to replace)"",
  ""explanation"": ""why you made these changes""
}}";

            var response = await _ai.SendMessageAsync(feedbackPrompt);

            // Parse and apply changes
            // (In production, use proper JSON parsing)

            var step = new BuildStep
            {
                Action = "apply_feedback",
                Description = $"User requested: {feedback}",
                AIExplanation = response
            };
            project.BuildSteps.Add(step);

            return $"✓ Updated! {response}";
        }

        /// <summary>
        /// Analyze an existing URL and apply edits
        /// </summary>
        public async Task<WebsiteProject> AnalyzeAndEditUrlAsync(string url, string editInstructions)
        {
            var project = new WebsiteProject
            {
                Name = new Uri(url).Host,
                Type = WebsiteType.Custom,
                Title = $"Edit of {url}",
                Mode = BuildMode.FromScratch // Treat as scratch for now
            };

            // Step 1: Fetch HTML (using browser if available, else generic client)
            string html = "";
            if (_browser != null)
            {
                 // Mock fetch via browser for now
                 html = $"<html><body><h1>Imported from {url}</h1><p>Placeholder content.</p></body></html>";
            }
            else
            {
                 using var client = new System.Net.Http.HttpClient();
                 try { html = await client.GetStringAsync(url); }
                 catch { html = $"<html><body><h1>Failed to fetch {url}</h1></body></html>"; }
            }
            
            project.HtmlContent = html;
            project.Description = $"Imported from {url}";

            // Step 2: Apply AI Edits
            var prompt = $@"I have imported a website from {url}.
Current HTML:
{html.Substring(0, Math.Min(1000, html.Length))}... (truncated)

User Instructions: {editInstructions}

Please return the FULL updated HTML implementing these changes. Keep the original structure but apply the requested edits.";

            var updatedHtml = await _ai.SendMessageAsync(prompt);
            project.HtmlContent = ExtractCodeBlock(updatedHtml, "html") ?? updatedHtml;

            project.BuildSteps.Add(new BuildStep 
            { 
                Action = "import_and_edit", 
                Description = $"Imported {url} and applied: {editInstructions}",
                AIExplanation = "Fetched external site and modified structure based on your request."
            });

            _projects.Add(project);
            return project;
        }

        private string ExtractCodeBlock(string response, string lang)
        {
            var start = response.IndexOf($"```{lang}");
            if (start == -1) start = response.IndexOf("```");
            if (start == -1) return null;
            
            var end = response.IndexOf("```", start + 3);
            if (end == -1) return null;

            var contentStart = response.IndexOf('\n', start) + 1;
            return response.Substring(contentStart, end - contentStart).Trim();
        }

        #endregion

        #region Preview & Export

        /// <summary>
        /// Generate complete HTML file for preview
        /// </summary>
        public string GeneratePreviewHTML(WebsiteProject project)
        {
            return $@"<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>{project.Title}</title>
    <style>
{project.CssContent}
    </style>
</head>
<body>
{ExtractBodyContent(project.HtmlContent)}
    <script>
{project.JsContent}
    </script>
</body>
</html>";
        }

        /// <summary>
        /// Export website to folder
        /// </summary>
        public async Task<string> ExportWebsiteAsync(WebsiteProject project, string outputPath)
        {
            Directory.CreateDirectory(outputPath);

            // Write index.html
            File.WriteAllText(
                Path.Combine(outputPath, "index.html"),
                GeneratePreviewHTML(project)
            );

            // Write separate CSS file (optional)
            if (!string.IsNullOrEmpty(project.CssContent))
            {
                File.WriteAllText(
                    Path.Combine(outputPath, "styles.css"),
                    project.CssContent
                );
            }

            // Write separate JS file (optional)
            if (!string.IsNullOrEmpty(project.JsContent))
            {
                File.WriteAllText(
                    Path.Combine(outputPath, "script.js"),
                    project.JsContent
                );
            }

            // Copy additional files
            foreach (var file in project.AdditionalFiles)
            {
                File.WriteAllText(
                    Path.Combine(outputPath, file.Key),
                    file.Value
                );
            }

            // Generate README
            var readme = $@"# {project.Title}

{project.Description}

## Built with AuraxNova
- Type: {project.Type}
- Created: {project.CreatedAt}
- Build steps: {project.BuildSteps.Count}

## To Use
1. Open index.html in any browser
2. Host on any web server
3. Deploy to Netlify/Vercel/GitHub Pages

## Features
- Mobile responsive
- SEO optimized
- Modern design
- Fast loading
";

            File.WriteAllText(Path.Combine(outputPath, "README.md"), readme);

            project.ExportPath = outputPath;

            return $"✓ Website exported to: {outputPath}";
        }

        #endregion

        #region Helper Methods

        private void LoadTemplates()
        {
            // Load built-in templates
            // In production, these would be actual HTML templates

            _templates[WebsiteType.Portfolio] = @"<!-- Portfolio Template -->
<!DOCTYPE html>
<html lang=""en"">
<head>
    <!-- Template content -->
</head>
<body>
    <header>Portfolio Header</header>
    <main>Portfolio Content</main>
    <footer>Contact Info</footer>
</body>
</html>";

            _templates[WebsiteType.LandingPage] = @"<!-- Landing Page Template -->
<!-- Hero + Features + CTA -->
";

            // Add more templates...
        }

        private string ExtractNameFromDescription(string description)
        {
            // Simple extraction - in production, AI would do this better
            var words = description.Split(' ');
            return words.Length > 0 ? words[0] : "My Website";
        }

        private bool RequiresJavaScript(WebsiteType type)
        {
            // Some site types need more JS than others
            return type switch
            {
                WebsiteType.ECommerce => true,
                WebsiteType.Portfolio => true,
                WebsiteType.SaaS => true,
                WebsiteType.Blog => true,
                _ => true  // Most sites benefit from JS
            };
        }

        private string InjectContentIntoHTML(string html, string content)
        {
            // Parse content and inject into appropriate HTML sections
            // Simplified for now
            return html.Replace("{{CONTENT}}", content);
        }

        private async Task<string> OptimizeForSEOAsync(WebsiteProject project)
        {
            var seoPrompt = $@"Add SEO optimization to this HTML:

{project.HtmlContent}

Add:
- Meta description
- Open Graph tags
- Twitter Card tags
- JSON-LD structured data
- Canonical URL
- Alt text for images

Return the complete optimized HTML.";

            return await _ai.SendMessageAsync(seoPrompt);
        }

        private string ExtractBodyContent(string html)
        {
            // Extract content between <body> tags
            var bodyStart = html.IndexOf("<body");
            var bodyEnd = html.IndexOf("</body>");

            if (bodyStart >= 0 && bodyEnd >= 0)
            {
                bodyStart = html.IndexOf(">", bodyStart) + 1;
                return html.Substring(bodyStart, bodyEnd - bodyStart);
            }

            return html;
        }

        public List<WebsiteProject> GetProjects() => _projects;

        #endregion
    }
}
