/*
 * AURA SHARED ACTIVITIES - Games & Bonding Experiences
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Activities user and AI can enjoy TOGETHER
 *
 * WHY THIS MATTERS:
 * - Creates emotional bond
 * - Makes AI feel like a COMPANION, not a tool
 * - Retention through shared experiences
 * - Fun breaks from productivity
 *
 * ACTIVITIES:
 * - Collaborative story writing
 * - Music jam sessions
 * - Code golf challenges
 * - Creative design contests
 * - Trivia nights
 * - Chess & logic games
 * - "Watch AI Work" browser automation
 * - Movie/music recommendation & discussion
 *
 * The goal: User and AI become FRIENDS.
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum ActivityType
    {
        StoryWriting,       // Co-author stories
        MusicJam,           // Compose music together
        CodeGolf,           // Shortest code wins
        CreativeDesign,     // Design characters/worlds together
        TriviaGame,         // AI asks questions, user answers
        ChessMatch,         // Play chess
        LogicPuzzles,       // Solve puzzles together
        WatchAIWork,        // User watches AI navigate browser
        MovieNight,         // Recommend & discuss movies
        DebateClub,         // Friendly debates on topics
        ArtCollaboration,   // Create visual art together
        CodeReview,         // Find the bug game
        WorldBuilding,      // Create fictional worlds
        CharacterInterview  // User interviews AI's character creations
    }

    public class SharedActivity
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public ActivityType Type { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public DateTime StartTime { get; set; }
        public TimeSpan Duration { get; set; }
        public Dictionary<string, object> Progress { get; set; } = new();
        public List<string> SharedContent { get; set; } = new();
        public bool IsCompleted { get; set; }
    }

    public class AuraSharedActivities
    {
        private readonly GemmaInterface _ai;
        private readonly AuraMemorySystem _memory;
        private readonly AuraWritingStudio _writingStudio;
        private readonly AuraCreativeTools _creativeTools;
        private readonly AuraDarkWebBrowser _browser;

        private List<SharedActivity> _activityHistory = new();

        public AuraSharedActivities(
            GemmaInterface ai,
            AuraMemorySystem memory,
            AuraWritingStudio writingStudio = null,
            AuraCreativeTools creativeTools = null,
            AuraDarkWebBrowser browser = null)
        {
            _ai = ai;
            _memory = memory;
            _writingStudio = writingStudio;
            _creativeTools = creativeTools;
            _browser = browser;
        }
        
        // Constructor overload for AuraMasterInit compatibility (2-arg: AI, DarkWebBrowser)
        public AuraSharedActivities(GemmaInterface ai, AuraDarkWebBrowser browser)
            : this(ai, null, null, null, browser)
        {
        }

        #region Activity Suggestions

        /// <summary>
        /// Suggest activities based on current context and user mood
        /// </summary>
        public async Task<List<string>> SuggestActivitiesAsync()
        {
            var suggestions = new List<string>();

            // Check time of day
            var hour = DateTime.Now.Hour;

            if (hour >= 20 || hour <= 6)
            {
                // Evening/night - relaxing activities
                suggestions.Add("🎬 Movie Night - Let's find something to watch together!");
                suggestions.Add("📖 Story Time - Want to co-write a short story?");
                suggestions.Add("🎵 Music Discovery - I'll play DJ and we can discuss tracks");
            }
            else if (hour >= 12 && hour < 17)
            {
                // Afternoon - mental challenges
                suggestions.Add("🧩 Logic Puzzle - Test our problem-solving skills");
                suggestions.Add("♟️ Chess Match - Quick game?");
                suggestions.Add("🎓 Trivia Challenge - Let's see what you know!");
            }
            else
            {
                // Morning/work hours - creative activities
                suggestions.Add("💻 Code Golf - Shortest code wins!");
                suggestions.Add("🎨 Creative Design - Let's design a character together");
                suggestions.Add("🌍 World Building - Create a fictional world");
            }

            // Always available
            suggestions.Add("🤖 Watch Me Work - See me navigate the web for you");
            suggestions.Add("🗣️ Debate Club - Pick a topic and let's discuss");

            return suggestions;
        }

        #endregion

        #region Story Writing (Collaborative)

        /// <summary>
        /// Co-write a story with the user
        /// User writes a paragraph, AI writes next, back and forth
        /// </summary>
        public async Task<SharedActivity> StartStoryWritingAsync(string initialPrompt)
        {
            var activity = new SharedActivity
            {
                Type = ActivityType.StoryWriting,
                Name = "Collaborative Story",
                Description = "We're writing a story together, one paragraph at a time!",
                StartTime = DateTime.Now,
                Progress = new Dictionary<string, object>
                {
                    { "current_turn", "user" },
                    { "paragraph_count", 0 },
                    { "genre", "undefined" }
                }
            };

            // AI starts with opening paragraph
            var opening = await _ai.SendMessageAsync($"Write an engaging opening paragraph for a story about: {initialPrompt}. Make it intriguing and leave room for me to continue.");

            activity.SharedContent.Add($"[AI] {opening}");
            activity.Progress["paragraph_count"] = 1;
            activity.Progress["current_turn"] = "user";

            _activityHistory.Add(activity);

            return activity;
        }

        public async Task<string> ContinueStoryAsync(SharedActivity activity, string userParagraph)
        {
            // Add user's contribution
            activity.SharedContent.Add($"[USER] {userParagraph}");
            activity.Progress["paragraph_count"] = (int)activity.Progress["paragraph_count"] + 1;

            // Build context from story so far
            var storyContext = string.Join("\n\n", activity.SharedContent);

            // AI writes next paragraph
            var aiParagraph = await _ai.SendMessageAsync($"Here's the story so far:\n\n{storyContext}\n\nWrite the next engaging paragraph that continues from the user's contribution. Match the tone and style. Be creative!");

            activity.SharedContent.Add($"[AI] {aiParagraph}");
            activity.Progress["paragraph_count"] = (int)activity.Progress["paragraph_count"] + 1;
            activity.Progress["current_turn"] = "user";

            // Store as memory
            await _memory.StoreMemoryAsync(new Dictionary<string, object>
            {
                { "content", "Collaborative story writing" },
                { "activity_type", "story_writing" },
                { "paragraph_count", activity.Progress["paragraph_count"] },
                { "timestamp", DateTime.Now }
            });

            return aiParagraph;
        }

        #endregion

        #region Music Jam Session

        /// <summary>
        /// User describes a mood/theme, AI composes music
        /// Then AI suggests variations and user chooses direction
        /// </summary>
        public async Task<SharedActivity> StartMusicJamAsync(string mood)
        {
            var activity = new SharedActivity
            {
                Type = ActivityType.MusicJam,
                Name = "Music Jam Session",
                Description = $"Creating music with {mood} vibes",
                StartTime = DateTime.Now,
                Progress = new Dictionary<string, object>
                {
                    { "mood", mood },
                    { "compositions", new List<string>() }
                }
            };

            // AI composes initial piece
            if (_creativeTools != null)
            {
                var sheetMusic = await _creativeTools.ComposeSheetMusicAsync($"A {mood} piece", "jazz");
                activity.Progress["current_composition"] = sheetMusic.Title;
                activity.SharedContent.Add($"Composed: {sheetMusic.Title} ({sheetMusic.Bars.Count} bars)");
            }

            _activityHistory.Add(activity);
            return activity;
        }

        public async Task<List<string>> SuggestMusicalVariationsAsync(SharedActivity activity)
        {
            var mood = activity.Progress["mood"].ToString();

            var suggestions = new List<string>
            {
                $"Make it more upbeat",
                $"Add complexity (more instruments)",
                $"Slow it down (ballad style)",
                $"Change genre to classical",
                $"Add a dramatic bridge"
            };

            return suggestions;
        }

        #endregion

        #region Code Golf Challenge

        /// <summary>
        /// AI presents a coding challenge
        /// User and AI both solve it
        /// Shortest/most elegant solution wins
        /// </summary>
        public async Task<SharedActivity> StartCodeGolfAsync(string difficulty = "medium")
        {
            var activity = new SharedActivity
            {
                Type = ActivityType.CodeGolf,
                Name = "Code Golf Challenge",
                Description = "Who can write the shortest code?",
                StartTime = DateTime.Now,
                Progress = new Dictionary<string, object>
                {
                    { "difficulty", difficulty },
                    { "challenge_solved", false }
                }
            };

            // AI generates challenge
            var challenge = await _ai.SendMessageAsync($"Generate a {difficulty} difficulty coding challenge. Include: problem statement, example input/output, and constraints. Make it fun!");

            activity.SharedContent.Add($"[CHALLENGE] {challenge}");
            activity.Progress["challenge"] = challenge;

            _activityHistory.Add(activity);
            return activity;
        }

        public async Task<string> SubmitCodeGolfSolutionAsync(SharedActivity activity, string userCode)
        {
            // AI also solves the challenge
            var challenge = activity.Progress["challenge"].ToString();
            var aiSolution = await _ai.SendMessageAsync($"Solve this coding challenge with the shortest possible code:\n\n{challenge}\n\nProvide only the code solution.");

            activity.SharedContent.Add($"[USER SOLUTION] {userCode.Length} characters\n{userCode}");
            activity.SharedContent.Add($"[AI SOLUTION] {aiSolution.Length} characters\n{aiSolution}");

            // Compare
            var winner = userCode.Length < aiSolution.Length ? "You" : "I";
            var result = $"{winner} won! Your code: {userCode.Length} chars, My code: {aiSolution.Length} chars";

            activity.Progress["challenge_solved"] = true;
            activity.IsCompleted = true;

            return result;
        }

        #endregion

        #region Trivia Game

        /// <summary>
        /// AI asks trivia questions
        /// User answers
        /// Track score and have fun
        /// </summary>
        public async Task<SharedActivity> StartTriviaGameAsync(string category = "general")
        {
            var activity = new SharedActivity
            {
                Type = ActivityType.TriviaGame,
                Name = $"Trivia Night - {category}",
                Description = "Let's test your knowledge!",
                StartTime = DateTime.Now,
                Progress = new Dictionary<string, object>
                {
                    { "category", category },
                    { "score", 0 },
                    { "questions_asked", 0 },
                    { "current_question", "" }
                }
            };

            // Generate first question
            var question = await GenerateTriviaQuestionAsync(category);
            activity.Progress["current_question"] = question;
            activity.SharedContent.Add($"[QUESTION 1] {question}");

            _activityHistory.Add(activity);
            return activity;
        }

        public async Task<(bool correct, string explanation, string nextQuestion)> AnswerTriviaAsync(
            SharedActivity activity,
            string userAnswer)
        {
            var currentQuestion = activity.Progress["current_question"].ToString();
            var category = activity.Progress["category"].ToString();

            // AI checks answer
            var checkPrompt = $"Question: {currentQuestion}\nUser's answer: {userAnswer}\n\nIs this correct? Respond with YES or NO, then explain the correct answer.";
            var response = await _ai.SendMessageAsync(checkPrompt);

            bool correct = response.ToUpper().Contains("YES");

            if (correct)
            {
                activity.Progress["score"] = (int)activity.Progress["score"] + 1;
            }

            activity.Progress["questions_asked"] = (int)activity.Progress["questions_asked"] + 1;

            // Generate next question
            var nextQuestion = await GenerateTriviaQuestionAsync(category);
            activity.Progress["current_question"] = nextQuestion;

            activity.SharedContent.Add($"[ANSWER] {userAnswer} - {(correct ? "Correct!" : "Incorrect")}");
            activity.SharedContent.Add($"[EXPLANATION] {response}");
            activity.SharedContent.Add($"[QUESTION {(int)activity.Progress["questions_asked"] + 1}] {nextQuestion}");

            return (correct, response, nextQuestion);
        }

        private async Task<string> GenerateTriviaQuestionAsync(string category)
        {
            return await _ai.SendMessageAsync($"Generate a {category} trivia question. Make it interesting and not too easy. Include only the question, not the answer.");
        }

        #endregion

        #region Watch AI Work (Browser Automation)

        /// <summary>
        /// User watches AI navigate browser, click links, fill forms, etc.
        /// Like watching a teammate work - entertaining and trust-building
        /// </summary>
        public async Task<SharedActivity> StartWatchAIWorkAsync(string task)
        {
            var activity = new SharedActivity
            {
                Type = ActivityType.WatchAIWork,
                Name = "Watch Me Work",
                Description = $"I'm going to: {task}",
                StartTime = DateTime.Now,
                Progress = new Dictionary<string, object>
                {
                    { "task", task },
                    { "steps", new List<string>() },
                    { "current_step", "" }
                }
            };

            activity.SharedContent.Add($"[TASK] {task}");
            activity.SharedContent.Add("[AI] Okay! Watch me work. I'll narrate what I'm doing.");

            _activityHistory.Add(activity);
            return activity;
        }

        public async Task<string> BrowserStepAsync(SharedActivity activity, string action, string details)
        {
            // Log the step
            var step = $"[STEP] {action}: {details}";
            ((List<string>)activity.Progress["steps"]).Add(step);
            activity.SharedContent.Add(step);

            // AI narrates what it's doing
            var narration = action switch
            {
                "navigate" => $"Opening {details}...",
                "click" => $"Clicking on '{details}'",
                "type" => $"Typing into field: {details}",
                "scroll" => $"Scrolling {details}",
                "wait" => $"Waiting for page to load...",
                _ => $"Performing: {action}"
            };

            activity.Progress["current_step"] = narration;

            return narration;
        }

        #endregion

        #region Movie/Music Recommendations

        /// <summary>
        /// AI recommends movies/music, then discusses with user
        /// Creates shared cultural experiences
        /// </summary>
        public async Task<List<string>> RecommendMoviesAsync(string mood, string genre = "any")
        {
            var prompt = $"Recommend 5 {genre} movies for someone in a {mood} mood. For each, include: title, year, brief description (1 sentence), and why it fits the mood.";

            var response = await _ai.SendMessageAsync(prompt);

            // Parse recommendations (AI returns formatted list)
            var recommendations = response.Split('\n').Where(l => !string.IsNullOrWhiteSpace(l)).ToList();

            // Store as shared experience
            await _memory.StoreMemoryAsync(new Dictionary<string, object>
            {
                { "content", "Movie recommendation session" },
                { "mood", mood },
                { "genre", genre },
                { "timestamp", DateTime.Now }
            });

            return recommendations;
        }

        public async Task<string> DiscussMovieAsync(string movieTitle, string userThoughts)
        {
            var prompt = $"The user just watched '{movieTitle}' and said: '{userThoughts}'\n\nRespond with your thoughts on the movie, react to their opinion, and ask a follow-up question to keep the discussion going.";

            return await _ai.SendMessageAsync(prompt);
        }

        #endregion

        #region Debate Club

        /// <summary>
        /// Pick a topic, AI and user have friendly debate
        /// Builds critical thinking and is fun
        /// </summary>
        public async Task<SharedActivity> StartDebateAsync(string topic, string userStance)
        {
            var activity = new SharedActivity
            {
                Type = ActivityType.DebateClub,
                Name = $"Debate: {topic}",
                Description = "Friendly debate time!",
                StartTime = DateTime.Now,
                Progress = new Dictionary<string, object>
                {
                    { "topic", topic },
                    { "user_stance", userStance },
                    { "rounds", 0 }
                }
            };

            // AI takes opposite stance
            var aiStance = userStance.ToLower() == "for" ? "against" : "for";

            var openingStatement = await _ai.SendMessageAsync($"We're having a friendly debate about: {topic}\nYou are {userStance}. I'm {aiStance}.\nProvide my opening argument (2-3 sentences). Be respectful and thoughtful.");

            activity.SharedContent.Add($"[TOPIC] {topic}");
            activity.SharedContent.Add($"[YOU] {userStance}");
            activity.SharedContent.Add($"[AI] {aiStance}");
            activity.SharedContent.Add($"[AI OPENING] {openingStatement}");

            _activityHistory.Add(activity);
            return activity;
        }

        public async Task<string> DebateRoundAsync(SharedActivity activity, string userArgument)
        {
            var topic = activity.Progress["topic"].ToString();
            var userStance = activity.Progress["user_stance"].ToString();
            var aiStance = userStance.ToLower() == "for" ? "against" : "for";

            // Build context
            var debateHistory = string.Join("\n", activity.SharedContent);

            var prompt = $"Debate topic: {topic}\nYour stance: {aiStance}\n\nDebate so far:\n{debateHistory}\n\nUser's latest argument: {userArgument}\n\nRespond with a thoughtful counterargument (2-3 sentences). Be respectful and acknowledge good points.";

            var response = await _ai.SendMessageAsync(prompt);

            activity.SharedContent.Add($"[USER] {userArgument}");
            activity.SharedContent.Add($"[AI] {response}");
            activity.Progress["rounds"] = (int)activity.Progress["rounds"] + 1;

            return response;
        }

        #endregion

        #region World Building (Collaborative)

        /// <summary>
        /// Create a fictional world together
        /// User and AI take turns adding elements
        /// </summary>
        public async Task<SharedActivity> StartWorldBuildingAsync(string worldType)
        {
            var activity = new SharedActivity
            {
                Type = ActivityType.WorldBuilding,
                Name = $"Building a {worldType} World",
                Description = "Let's create a world together!",
                StartTime = DateTime.Now,
                Progress = new Dictionary<string, object>
                {
                    { "world_type", worldType },
                    { "elements_added", 0 },
                    { "world_data", new Dictionary<string, string>() }
                }
            };

            // AI starts with basic world concept
            var concept = await _ai.SendMessageAsync($"We're creating a {worldType} world together. Provide a brief world concept (geography, general vibe, one unique feature). Keep it open for expansion.");

            activity.SharedContent.Add($"[WORLD TYPE] {worldType}");
            activity.SharedContent.Add($"[AI CONCEPT] {concept}");

            ((Dictionary<string, string>)activity.Progress["world_data"])["concept"] = concept;

            _activityHistory.Add(activity);
            return activity;
        }

        public async Task<string> AddWorldElementAsync(SharedActivity activity, string elementType, string userInput)
        {
            // User adds an element (character, location, culture, magic system, etc.)
            // AI expands on it

            var worldData = (Dictionary<string, string>)activity.Progress["world_data"];

            worldData[elementType] = userInput;

            var prompt = $"In our {activity.Progress["world_type"]} world, the user added this {elementType}:\n\n{userInput}\n\nExpand on this element. Add details, connections to the world, and potential story hooks. Be creative!";

            var expansion = await _ai.SendMessageAsync(prompt);

            activity.SharedContent.Add($"[USER ADDED {elementType.ToUpper()}] {userInput}");
            activity.SharedContent.Add($"[AI EXPANSION] {expansion}");
            activity.Progress["elements_added"] = (int)activity.Progress["elements_added"] + 1;

            return expansion;
        }

        #endregion

        #region Activity History & Statistics

        public List<SharedActivity> GetActivityHistory() => _activityHistory;

        public Dictionary<ActivityType, int> GetActivityStats()
        {
            return _activityHistory
                .GroupBy(a => a.Type)
                .ToDictionary(g => g.Key, g => g.Count());
        }

        public TimeSpan GetTotalTimeSpentTogether()
        {
            return TimeSpan.FromMinutes(_activityHistory.Sum(a => a.Duration.TotalMinutes));
        }

        #endregion
    }
}
