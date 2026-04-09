/*
 * AURA CODE LIBRARY MANAGER - Multi-Language Development
 * ARCHITECT: DILLAN COPELAND
 *
 * Pure C# code execution and development tools.
 * NO PYTHON DEPENDENCIES - fully self-contained.
 *
 * SUPPORTED LANGUAGES:
 * - HTML/CSS/JavaScript (built-in)
 * - React/JSX (via Node.js if available)
 * - TypeScript (via Node.js if available)
 * - C# (.NET compilation)
 * - JSON/YAML configuration
 *
 * CAPABILITIES:
 * - Code generation via AI
 * - Syntax validation
 * - Live preview (HTML/CSS/JS)
 * - Project scaffolding
 * - Component library
 * - Template system
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum CodeLanguage
    {
        HTML,
        CSS,
        JavaScript,
        TypeScript,
        React,
        CSharp,
        JSON,
        YAML,
        Markdown,
        SQL
    }

    public class CodeFile
    {
        public string FileName { get; set; } = "";
        public string FilePath { get; set; } = "";
        public CodeLanguage Language { get; set; }
        public string Content { get; set; } = "";
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime ModifiedAt { get; set; } = DateTime.Now;
        public List<string> Dependencies { get; set; } = new();
        public bool IsValid { get; set; } = true;
        public List<string> ValidationErrors { get; set; } = new();
    }

    public class CodeProject
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Name { get; set; } = "";
        public string RootPath { get; set; } = "";
        public string ProjectType { get; set; } = "web";  // web, react, node, dotnet
        public List<CodeFile> Files { get; set; } = new();
        public Dictionary<string, string> Config { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

    public class CodeSnippet
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";

        // Language accepts string for flexibility
        private string _languageStr = "csharp";
        public string Language
        {
            get => _languageStr;
            set => _languageStr = value?.ToLower() ?? "csharp";
        }

        // Helper to get CodeLanguage enum
        public CodeLanguage LanguageEnum => _languageStr switch
        {
            "html" => CodeLanguage.HTML,
            "css" => CodeLanguage.CSS,
            "javascript" or "js" => CodeLanguage.JavaScript,
            "typescript" or "ts" => CodeLanguage.TypeScript,
            "react" or "jsx" => CodeLanguage.React,
            "csharp" or "c#" or "cs" => CodeLanguage.CSharp,
            "json" => CodeLanguage.JSON,
            "yaml" or "yml" => CodeLanguage.YAML,
            "markdown" or "md" => CodeLanguage.Markdown,
            "sql" => CodeLanguage.SQL,
            _ => CodeLanguage.CSharp
        };

        public string Code { get; set; } = "";
        public List<string> Tags { get; set; } = new();
        public int UsageCount { get; set; } = 0;

        // Additional properties - CodeCategory uses enum from AuraLibraryAccess
        public CodeCategory CodeCategory { get; set; } = CodeCategory.Utility;
        public string ExampleUsage { get; set; } = "";
        public List<string> Dependencies { get; set; } = new();
        public string Type { get; set; } = "snippet";
        public string Format { get; set; } = "text";

        // LibraryItem compatibility
        public string FilePath { get; set; } = "";
        public long FileSizeBytes { get; set; } = 0;
        public string Category { get; set; } = "code";
    }

    public class AuraCodeLibraryManager
    {
        private readonly GemmaInterface? _ai;
        private readonly string _libraryPath;
        private readonly string _projectsPath;
        private readonly string _snippetsPath;

        // Snippet library
        private Dictionary<string, CodeSnippet> _snippets = new();

        // Project tracking
        private List<CodeProject> _projects = new();

        // Node.js availability
        private bool _nodeAvailable = false;
        private string _nodePath = "";

        public event Action<string>? OnLog;
        public event Action<CodeFile>? OnFileGenerated;

        public AuraCodeLibraryManager(GemmaInterface? ai = null)
        {
            _ai = ai;
            _libraryPath = "E:/AuraNova_DataLake/CodeLibrary";
            _projectsPath = Path.Combine(_libraryPath, "Projects");
            _snippetsPath = Path.Combine(_libraryPath, "Snippets");

            Directory.CreateDirectory(_libraryPath);
            Directory.CreateDirectory(_projectsPath);
            Directory.CreateDirectory(_snippetsPath);

            CheckNodeAvailability();
            LoadSnippets();
            InitializeDefaultSnippets();

            OnLog?.Invoke("[CODE LIBRARY] Initialized");
        }

        // =========================================================================
        // NODE.JS DETECTION (for React/TypeScript)
        // =========================================================================

        private void CheckNodeAvailability()
        {
            try
            {
                var process = new Process
                {
                    StartInfo = new ProcessStartInfo
                    {
                        FileName = "node",
                        Arguments = "--version",
                        RedirectStandardOutput = true,
                        UseShellExecute = false,
                        CreateNoWindow = true
                    }
                };

                process.Start();
                var version = process.StandardOutput.ReadToEnd().Trim();
                process.WaitForExit();

                if (process.ExitCode == 0)
                {
                    _nodeAvailable = true;
                    _nodePath = "node";
                    OnLog?.Invoke($"[CODE LIBRARY] Node.js detected: {version}");
                }
            }
            catch
            {
                _nodeAvailable = false;
                OnLog?.Invoke("[CODE LIBRARY] Node.js not found - React/TypeScript compilation limited");
            }
        }

        // =========================================================================
        // CODE GENERATION (AI-Powered)
        // =========================================================================

        /// <summary>
        /// Generate code from natural language description.
        /// </summary>
        public async Task<CodeFile> GenerateCodeAsync(string description, CodeLanguage language)
        {
            if (_ai == null)
            {
                return GenerateTemplateCode(description, language);
            }

            var prompt = BuildCodeGenerationPrompt(description, language);
            var generatedCode = await _ai.SendMessageAsync(prompt);

            // Clean up AI response (extract just the code)
            generatedCode = ExtractCodeFromResponse(generatedCode, language);

            var file = new CodeFile
            {
                FileName = GenerateFileName(description, language),
                Language = language,
                Content = generatedCode
            };

            // Validate the generated code
            ValidateCode(file);

            OnFileGenerated?.Invoke(file);
            OnLog?.Invoke($"[CODE LIBRARY] Generated {language}: {file.FileName}");

            return file;
        }

        private string BuildCodeGenerationPrompt(string description, CodeLanguage language)
        {
            var languageHints = language switch
            {
                CodeLanguage.HTML => "Use semantic HTML5, include proper meta tags, make it accessible",
                CodeLanguage.CSS => "Use modern CSS (Grid, Flexbox), CSS variables, mobile-first responsive design",
                CodeLanguage.JavaScript => "Use ES6+ syntax, add comments, handle errors properly",
                CodeLanguage.TypeScript => "Use proper types, interfaces where appropriate, strict mode",
                CodeLanguage.React => "Use functional components with hooks, proper prop types, clean JSX",
                CodeLanguage.CSharp => "Use modern C# syntax, proper namespaces, XML documentation",
                CodeLanguage.JSON => "Valid JSON format, properly escaped",
                CodeLanguage.SQL => "Use parameterized queries, add comments for complex logic",
                _ => ""
            };

            return $@"Generate {language} code for: {description}

Requirements:
- {languageHints}
- Clean, readable code
- Include helpful comments
- Follow best practices

Return ONLY the code, no explanations before or after.";
        }

        private CodeFile GenerateTemplateCode(string description, CodeLanguage language)
        {
            // Fallback templates when AI is not available
            var template = language switch
            {
                CodeLanguage.HTML => GenerateHtmlTemplate(description),
                CodeLanguage.CSS => GenerateCssTemplate(description),
                CodeLanguage.JavaScript => GenerateJsTemplate(description),
                CodeLanguage.React => GenerateReactTemplate(description),
                CodeLanguage.CSharp => GenerateCSharpTemplate(description),
                _ => $"// {language} template for: {description}"
            };

            return new CodeFile
            {
                FileName = GenerateFileName(description, language),
                Language = language,
                Content = template
            };
        }

        // =========================================================================
        // TEMPLATE GENERATORS (No AI required)
        // =========================================================================

        private string GenerateHtmlTemplate(string description)
        {
            return $@"<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <meta name=""description"" content=""{description}"">
    <title>{description}</title>
    <link rel=""stylesheet"" href=""styles.css"">
</head>
<body>
    <header>
        <nav>
            <a href=""#"" class=""logo"">{description}</a>
            <ul class=""nav-links"">
                <li><a href=""#home"">Home</a></li>
                <li><a href=""#about"">About</a></li>
                <li><a href=""#contact"">Contact</a></li>
            </ul>
        </nav>
    </header>

    <main>
        <section id=""hero"">
            <h1>{description}</h1>
            <p>Welcome to our site. Add your content here.</p>
            <button class=""cta-button"">Get Started</button>
        </section>

        <section id=""about"">
            <h2>About</h2>
            <p>Add your about content here.</p>
        </section>

        <section id=""contact"">
            <h2>Contact</h2>
            <form id=""contact-form"">
                <input type=""text"" name=""name"" placeholder=""Your Name"" required>
                <input type=""email"" name=""email"" placeholder=""Your Email"" required>
                <textarea name=""message"" placeholder=""Your Message"" required></textarea>
                <button type=""submit"">Send Message</button>
            </form>
        </section>
    </main>

    <footer>
        <p>&copy; {DateTime.Now.Year} {description}. All rights reserved.</p>
    </footer>

    <script src=""script.js""></script>
</body>
</html>";
        }

        private string GenerateCssTemplate(string description)
        {
            return $@"/* Styles for: {description} */
/* Generated by AuraxNova */

:root {{
    --primary-color: #00ff00;
    --secondary-color: #0078d4;
    --background-dark: #1a1a2e;
    --background-light: #16213e;
    --text-color: #ffffff;
    --text-muted: #a0a0a0;
    --border-radius: 8px;
    --transition: all 0.3s ease;
}}

* {{
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}}

body {{
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: var(--background-dark);
    color: var(--text-color);
    line-height: 1.6;
}}

/* Navigation */
nav {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 5%;
    background: var(--background-light);
    position: sticky;
    top: 0;
    z-index: 100;
}}

.logo {{
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary-color);
    text-decoration: none;
}}

.nav-links {{
    display: flex;
    list-style: none;
    gap: 2rem;
}}

.nav-links a {{
    color: var(--text-color);
    text-decoration: none;
    transition: var(--transition);
}}

.nav-links a:hover {{
    color: var(--primary-color);
}}

/* Hero Section */
#hero {{
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 2rem;
}}

#hero h1 {{
    font-size: 3rem;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}}

/* Buttons */
.cta-button {{
    padding: 1rem 2rem;
    font-size: 1rem;
    background: var(--primary-color);
    color: var(--background-dark);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: var(--transition);
}}

.cta-button:hover {{
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0, 255, 0, 0.3);
}}

/* Sections */
section {{
    padding: 4rem 5%;
}}

section h2 {{
    font-size: 2rem;
    margin-bottom: 1rem;
    color: var(--primary-color);
}}

/* Forms */
form {{
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 500px;
}}

input, textarea {{
    padding: 1rem;
    background: var(--background-light);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius);
    color: var(--text-color);
    font-size: 1rem;
}}

input:focus, textarea:focus {{
    outline: none;
    border-color: var(--secondary-color);
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.2);
}}

/* Footer */
footer {{
    text-align: center;
    padding: 2rem;
    background: var(--background-light);
    color: var(--text-muted);
}}

/* Responsive */
@media (max-width: 768px) {{
    .nav-links {{
        display: none;
    }}

    #hero h1 {{
        font-size: 2rem;
    }}
}}

/* RGB Border Animation (AuraxNova Style) */
@keyframes rgb-border {{
    0% {{ border-color: #ff0000; }}
    33% {{ border-color: #00ff00; }}
    66% {{ border-color: #0000ff; }}
    100% {{ border-color: #ff0000; }}
}}

.rgb-border {{
    border: 2px solid;
    animation: rgb-border 3s linear infinite;
}}";
        }

        private string GenerateJsTemplate(string description)
        {
            return $@"/**
 * JavaScript for: {description}
 * Generated by AuraxNova
 */

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {{
    console.log('{description} loaded');

    initNavigation();
    initForms();
    initAnimations();
}});

// Navigation
function initNavigation() {{
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {{
        link.addEventListener('click', (e) => {{
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const target = document.querySelector(targetId);

            if (target) {{
                target.scrollIntoView({{
                    behavior: 'smooth',
                    block: 'start'
                }});
            }}
        }});
    }});
}}

// Form Handling
function initForms() {{
    const contactForm = document.getElementById('contact-form');

    if (contactForm) {{
        contactForm.addEventListener('submit', async (e) => {{
            e.preventDefault();

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData);

            console.log('Form submitted:', data);

            // Add your form submission logic here
            // Example: await submitForm(data);

            alert('Thank you for your message!');
            contactForm.reset();
        }});
    }}
}}

// Animations
function initAnimations() {{
    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {{
        entries.forEach(entry => {{
            if (entry.isIntersecting) {{
                entry.target.classList.add('visible');
            }}
        }});
    }}, {{ threshold: 0.1 }});

    // Observe all sections
    document.querySelectorAll('section').forEach(section => {{
        observer.observe(section);
    }});
}}

// Utility Functions
function debounce(func, wait) {{
    let timeout;
    return function executedFunction(...args) {{
        const later = () => {{
            clearTimeout(timeout);
            func(...args);
        }};
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    }};
}}

// Export for modules (if using ES modules)
if (typeof module !== 'undefined' && module.exports) {{
    module.exports = {{ initNavigation, initForms, initAnimations }};
}}";
        }

        private string GenerateReactTemplate(string description)
        {
            var componentName = ToPascalCase(description);
            return $@"/**
 * React Component: {componentName}
 * Generated by AuraxNova
 */

import React, {{ useState, useEffect }} from 'react';
import './styles.css';

// Main Component
export default function {componentName}() {{
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {{
        // Initialization logic
        const init = async () => {{
            try {{
                // Add your initialization logic here
                setLoading(false);
            }} catch (error) {{
                console.error('Initialization error:', error);
                setLoading(false);
            }}
        }};

        init();
    }}, []);

    if (loading) {{
        return <LoadingSpinner />;
    }}

    return (
        <div className=""{componentName.ToLower()}-container"">
            <Header title=""{description}"" />

            <main className=""main-content"">
                <HeroSection />
                <ContentSection />
            </main>

            <Footer />
        </div>
    );
}}

// Sub-components
function Header({{ title }}) {{
    return (
        <header className=""header"">
            <nav className=""nav"">
                <a href=""/"" className=""logo"">{{title}}</a>
                <ul className=""nav-links"">
                    <li><a href=""#home"">Home</a></li>
                    <li><a href=""#about"">About</a></li>
                    <li><a href=""#contact"">Contact</a></li>
                </ul>
            </nav>
        </header>
    );
}}

function HeroSection() {{
    return (
        <section id=""hero"" className=""hero"">
            <h1>{description}</h1>
            <p>Welcome! Add your content here.</p>
            <button className=""cta-button"" onClick={{() => console.log('CTA clicked')}}>
                Get Started
            </button>
        </section>
    );
}}

function ContentSection() {{
    return (
        <section id=""content"" className=""content"">
            <h2>Features</h2>
            <div className=""feature-grid"">
                <FeatureCard
                    title=""Feature 1""
                    description=""Description of feature 1""
                />
                <FeatureCard
                    title=""Feature 2""
                    description=""Description of feature 2""
                />
                <FeatureCard
                    title=""Feature 3""
                    description=""Description of feature 3""
                />
            </div>
        </section>
    );
}}

function FeatureCard({{ title, description }}) {{
    return (
        <div className=""feature-card"">
            <h3>{{title}}</h3>
            <p>{{description}}</p>
        </div>
    );
}}

function Footer() {{
    return (
        <footer className=""footer"">
            <p>&copy; {{new Date().getFullYear()}} {description}. All rights reserved.</p>
        </footer>
    );
}}

function LoadingSpinner() {{
    return (
        <div className=""loading-spinner"">
            <div className=""spinner""></div>
            <p>Loading...</p>
        </div>
    );
}}";
        }

        private string GenerateCSharpTemplate(string description)
        {
            var className = ToPascalCase(description);
            return $@"/*
 * {className}
 * Generated by AuraxNova
 * Description: {description}
 */

using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5
{{
    /// <summary>
    /// {description}
    /// </summary>
    public class {className}
    {{
        #region Fields

        private readonly string _name;
        private bool _initialized = false;

        #endregion

        #region Properties

        /// <summary>
        /// Gets the name of this instance.
        /// </summary>
        public string Name => _name;

        /// <summary>
        /// Gets whether this instance is initialized.
        /// </summary>
        public bool IsInitialized => _initialized;

        #endregion

        #region Events

        /// <summary>
        /// Raised when initialization completes.
        /// </summary>
        public event Action<{className}>? OnInitialized;

        #endregion

        #region Constructor

        /// <summary>
        /// Creates a new instance of {className}.
        /// </summary>
        /// <param name=""name"">The name for this instance.</param>
        public {className}(string name = ""{className}"")
        {{
            _name = name;
        }}

        #endregion

        #region Public Methods

        /// <summary>
        /// Initializes this instance.
        /// </summary>
        public async Task InitializeAsync()
        {{
            if (_initialized)
                return;

            // Add initialization logic here
            await Task.Delay(100); // Placeholder

            _initialized = true;
            OnInitialized?.Invoke(this);
        }}

        /// <summary>
        /// Performs the main operation.
        /// </summary>
        /// <returns>Result of the operation.</returns>
        public async Task<string> ExecuteAsync()
        {{
            if (!_initialized)
                await InitializeAsync();

            // Add main logic here
            return $""{{_name}} executed successfully"";
        }}

        #endregion

        #region Private Methods

        private void ValidateState()
        {{
            if (!_initialized)
                throw new InvalidOperationException($""{{_name}} is not initialized"");
        }}

        #endregion
    }}
}}";
        }

        // =========================================================================
        // CODE VALIDATION
        // =========================================================================

        /// <summary>
        /// Validate code syntax and structure.
        /// </summary>
        public void ValidateCode(CodeFile file)
        {
            file.ValidationErrors.Clear();
            file.IsValid = true;

            switch (file.Language)
            {
                case CodeLanguage.HTML:
                    ValidateHtml(file);
                    break;
                case CodeLanguage.CSS:
                    ValidateCss(file);
                    break;
                case CodeLanguage.JavaScript:
                case CodeLanguage.TypeScript:
                    ValidateJavaScript(file);
                    break;
                case CodeLanguage.JSON:
                    ValidateJson(file);
                    break;
                case CodeLanguage.React:
                    ValidateReact(file);
                    break;
            }
        }

        private void ValidateHtml(CodeFile file)
        {
            // Basic HTML validation
            if (!file.Content.Contains("<!DOCTYPE") && !file.Content.Contains("<!doctype"))
            {
                file.ValidationErrors.Add("Missing DOCTYPE declaration");
            }

            // Check for unclosed tags
            var openTags = Regex.Matches(file.Content, @"<(\w+)[^>]*(?<!/)>");
            var closeTags = Regex.Matches(file.Content, @"</(\w+)>");

            // Simplified check - real validation would be more complex
            if (openTags.Count - closeTags.Count > 5)
            {
                file.ValidationErrors.Add("Possible unclosed HTML tags");
            }

            file.IsValid = file.ValidationErrors.Count == 0;
        }

        private void ValidateCss(CodeFile file)
        {
            // Check for balanced braces
            int openBraces = file.Content.Count(c => c == '{');
            int closeBraces = file.Content.Count(c => c == '}');

            if (openBraces != closeBraces)
            {
                file.ValidationErrors.Add($"Unbalanced braces: {openBraces} open, {closeBraces} close");
            }

            // Check for common syntax errors
            if (Regex.IsMatch(file.Content, @";\s*;"))
            {
                file.ValidationErrors.Add("Double semicolons detected");
            }

            file.IsValid = file.ValidationErrors.Count == 0;
        }

        private void ValidateJavaScript(CodeFile file)
        {
            // Check for balanced braces and parentheses
            int openBraces = file.Content.Count(c => c == '{');
            int closeBraces = file.Content.Count(c => c == '}');
            int openParens = file.Content.Count(c => c == '(');
            int closeParens = file.Content.Count(c => c == ')');

            if (openBraces != closeBraces)
            {
                file.ValidationErrors.Add($"Unbalanced braces: {openBraces} open, {closeBraces} close");
            }

            if (openParens != closeParens)
            {
                file.ValidationErrors.Add($"Unbalanced parentheses: {openParens} open, {closeParens} close");
            }

            file.IsValid = file.ValidationErrors.Count == 0;
        }

        private void ValidateJson(CodeFile file)
        {
            try
            {
                JsonDocument.Parse(file.Content);
            }
            catch (JsonException ex)
            {
                file.ValidationErrors.Add($"Invalid JSON: {ex.Message}");
                file.IsValid = false;
            }
        }

        private void ValidateReact(CodeFile file)
        {
            // Basic JSX validation
            ValidateJavaScript(file);

            // Check for common React issues
            if (!file.Content.Contains("import React") && !file.Content.Contains("from 'react'"))
            {
                file.ValidationErrors.Add("Missing React import (may be using React 17+ automatic runtime)");
            }

            // Check for default export
            if (!file.Content.Contains("export default"))
            {
                file.ValidationErrors.Add("Missing default export");
            }
        }

        // =========================================================================
        // PROJECT SCAFFOLDING
        // =========================================================================

        /// <summary>
        /// Create a new project with standard structure.
        /// </summary>
        public CodeProject CreateProject(string name, string projectType)
        {
            var projectPath = Path.Combine(_projectsPath, name);
            Directory.CreateDirectory(projectPath);

            var project = new CodeProject
            {
                Name = name,
                RootPath = projectPath,
                ProjectType = projectType
            };

            switch (projectType.ToLower())
            {
                case "web":
                    ScaffoldWebProject(project);
                    break;
                case "react":
                    ScaffoldReactProject(project);
                    break;
                default:
                    ScaffoldBasicProject(project);
                    break;
            }

            _projects.Add(project);
            SaveProject(project);

            OnLog?.Invoke($"[CODE LIBRARY] Created {projectType} project: {name}");
            return project;
        }

        private void ScaffoldWebProject(CodeProject project)
        {
            // Create standard web project structure
            var html = GenerateHtmlTemplate(project.Name);
            var css = GenerateCssTemplate(project.Name);
            var js = GenerateJsTemplate(project.Name);

            project.Files.Add(new CodeFile { FileName = "index.html", Language = CodeLanguage.HTML, Content = html });
            project.Files.Add(new CodeFile { FileName = "styles.css", Language = CodeLanguage.CSS, Content = css });
            project.Files.Add(new CodeFile { FileName = "script.js", Language = CodeLanguage.JavaScript, Content = js });

            // Write files
            foreach (var file in project.Files)
            {
                file.FilePath = Path.Combine(project.RootPath, file.FileName);
                File.WriteAllText(file.FilePath, file.Content);
            }
        }

        private void ScaffoldReactProject(CodeProject project)
        {
            Directory.CreateDirectory(Path.Combine(project.RootPath, "src"));
            Directory.CreateDirectory(Path.Combine(project.RootPath, "public"));

            // Package.json
            var packageJson = $@"{{
  ""name"": ""{project.Name.ToLower().Replace(" ", "-")}"",
  ""version"": ""1.0.0"",
  ""private"": true,
  ""dependencies"": {{
    ""react"": ""^18.2.0"",
    ""react-dom"": ""^18.2.0""
  }},
  ""scripts"": {{
    ""start"": ""react-scripts start"",
    ""build"": ""react-scripts build"",
    ""test"": ""react-scripts test""
  }}
}}";

            // Main component
            var appComponent = GenerateReactTemplate(project.Name);

            project.Files.Add(new CodeFile { FileName = "package.json", Language = CodeLanguage.JSON, Content = packageJson });
            project.Files.Add(new CodeFile { FileName = "src/App.jsx", Language = CodeLanguage.React, Content = appComponent });

            // Write files
            foreach (var file in project.Files)
            {
                var filePath = Path.Combine(project.RootPath, file.FileName);
                Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
                File.WriteAllText(filePath, file.Content);
                file.FilePath = filePath;
            }
        }

        private void ScaffoldBasicProject(CodeProject project)
        {
            var readme = $"# {project.Name}\n\nGenerated by AuraxNova";
            project.Files.Add(new CodeFile { FileName = "README.md", Language = CodeLanguage.Markdown, Content = readme });

            foreach (var file in project.Files)
            {
                file.FilePath = Path.Combine(project.RootPath, file.FileName);
                File.WriteAllText(file.FilePath, file.Content);
            }
        }

        // =========================================================================
        // SNIPPET LIBRARY
        // =========================================================================

        private void InitializeDefaultSnippets()
        {
            AddSnippet(new CodeSnippet
            {
                Id = "css-rgb-border",
                Name = "RGB Animated Border",
                Description = "AuraxNova-style animated RGB border",
                Language = CodeLanguage.CSS.ToString(),
                Code = @"@keyframes rgb-border {
    0% { border-color: #ff0000; }
    33% { border-color: #00ff00; }
    66% { border-color: #0000ff; }
    100% { border-color: #ff0000; }
}

.rgb-border {
    border: 2px solid;
    animation: rgb-border 3s linear infinite;
}",
                Tags = new List<string> { "animation", "border", "rgb", "auraxnova" }
            });

            AddSnippet(new CodeSnippet
            {
                Id = "js-debounce",
                Name = "Debounce Function",
                Description = "Utility function to debounce frequent calls",
                Language = CodeLanguage.JavaScript.ToString(),
                Code = @"function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}",
                Tags = new List<string> { "utility", "performance", "events" }
            });

            AddSnippet(new CodeSnippet
            {
                Id = "react-uselocalstorage",
                Name = "useLocalStorage Hook",
                Description = "React hook for persistent local storage state",
                Language = CodeLanguage.React.ToString(),
                Code = @"function useLocalStorage(key, initialValue) {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
}",
                Tags = new List<string> { "react", "hooks", "storage", "state" }
            });

            SaveSnippets();
        }

        public void AddSnippet(CodeSnippet snippet)
        {
            _snippets[snippet.Id] = snippet;
        }

        public CodeSnippet? GetSnippet(string id)
        {
            return _snippets.GetValueOrDefault(id);
        }

        public List<CodeSnippet> SearchSnippets(string query)
        {
            var queryLower = query.ToLower();
            return _snippets.Values
                .Where(s => s.Name.ToLower().Contains(queryLower) ||
                           s.Description.ToLower().Contains(queryLower) ||
                           s.Tags.Any(t => t.ToLower().Contains(queryLower)))
                .ToList();
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void SaveProject(CodeProject project)
        {
            var projectFile = Path.Combine(project.RootPath, "project.json");
            var json = JsonSerializer.Serialize(project, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(projectFile, json);
        }

        private void LoadSnippets()
        {
            var snippetsFile = Path.Combine(_snippetsPath, "snippets.json");
            if (File.Exists(snippetsFile))
            {
                try
                {
                    var json = File.ReadAllText(snippetsFile);
                    _snippets = JsonSerializer.Deserialize<Dictionary<string, CodeSnippet>>(json) ?? new();
                }
                catch { }
            }
        }

        private void SaveSnippets()
        {
            var snippetsFile = Path.Combine(_snippetsPath, "snippets.json");
            var json = JsonSerializer.Serialize(_snippets, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(snippetsFile, json);
        }

        // =========================================================================
        // UTILITIES
        // =========================================================================

        private string ExtractCodeFromResponse(string response, CodeLanguage language)
        {
            // Try to extract code from markdown code blocks
            var codeBlockPattern = language switch
            {
                CodeLanguage.HTML => @"```html\s*([\s\S]*?)\s*```",
                CodeLanguage.CSS => @"```css\s*([\s\S]*?)\s*```",
                CodeLanguage.JavaScript => @"```(?:javascript|js)\s*([\s\S]*?)\s*```",
                CodeLanguage.TypeScript => @"```(?:typescript|ts)\s*([\s\S]*?)\s*```",
                CodeLanguage.React => @"```(?:jsx|tsx|react)\s*([\s\S]*?)\s*```",
                CodeLanguage.CSharp => @"```(?:csharp|cs)\s*([\s\S]*?)\s*```",
                CodeLanguage.JSON => @"```json\s*([\s\S]*?)\s*```",
                _ => @"```\s*([\s\S]*?)\s*```"
            };

            var match = Regex.Match(response, codeBlockPattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return match.Groups[1].Value.Trim();
            }

            // If no code block found, return as-is (might already be clean code)
            return response.Trim();
        }

        private string GenerateFileName(string description, CodeLanguage language)
        {
            var baseName = ToPascalCase(description.Split(' ').Take(3).Aggregate((a, b) => a + b));

            var extension = language switch
            {
                CodeLanguage.HTML => ".html",
                CodeLanguage.CSS => ".css",
                CodeLanguage.JavaScript => ".js",
                CodeLanguage.TypeScript => ".ts",
                CodeLanguage.React => ".jsx",
                CodeLanguage.CSharp => ".cs",
                CodeLanguage.JSON => ".json",
                CodeLanguage.YAML => ".yaml",
                CodeLanguage.Markdown => ".md",
                CodeLanguage.SQL => ".sql",
                _ => ".txt"
            };

            return baseName + extension;
        }

        private string ToPascalCase(string input)
        {
            if (string.IsNullOrEmpty(input)) return "Generated";

            var words = Regex.Split(input, @"[\s_-]+");
            var result = new StringBuilder();

            foreach (var word in words)
            {
                if (word.Length > 0)
                {
                    result.Append(char.ToUpper(word[0]));
                    if (word.Length > 1)
                        result.Append(word.Substring(1).ToLower());
                }
            }

            return result.Length > 0 ? result.ToString() : "Generated";
        }

        public List<CodeProject> GetProjects() => _projects;
        public Dictionary<string, CodeSnippet> GetAllSnippets() => _snippets;
    }
}
