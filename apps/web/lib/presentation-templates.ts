export interface PresentationTemplate {
  id: string
  name: string
  description: string
  icon: string
  slides: Array<{ title: string; content: string[]; layout: string }>
}

export const presentationTemplates: PresentationTemplate[] = [
  {
    id: "pitch-deck",
    name: "Pitch Deck",
    description: "Startup or product pitch with problem → solution → market → ask",
    icon: "rocket",
    slides: [
      { title: "", content: ["Your Company Name"], layout: "title" },
      { title: "The Problem", content: ["Pain point 1", "Pain point 2", "Pain point 3"], layout: "titleContent" },
      { title: "Our Solution", content: ["What we build", "How it works", "Why it matters"], layout: "titleContent" },
      { title: "Market Opportunity", content: ["82|Billion TAM", "34|Billion SAM", "12|Percent Growth"], layout: "stats" },
      { title: "How It Works", content: ["Step 1: User signs up", "Step 2: Gets personalized experience", "Step 3: Achieves desired outcome"], layout: "numberedSteps" },
      { title: "Traction", content: ["5000|Users", "120|Percent MoM Growth", "95|Percent Retention", "4.8|App Rating"], layout: "stats" },
      { title: "Business Model", content: ["Subscription tiers", "Usage-based pricing", "Enterprise contracts"], layout: "titleContent" },
      { title: "Competitive Landscape", content: ["Us vs Them|Feature A: Yes\nFeature B: Yes\nFeature C: Unique\n\nThem vs Us|Feature A: No\nFeature B: Limited\nFeature C: No"], layout: "comparison" },
      { title: "The Team", content: ["CEO — Vision & strategy", "CTO — Technical leadership", "Head of Growth — Scale"], layout: "titleContent" },
      { title: "The Ask", content: ["Raising $2M seed round", "Use of funds: product + GTM", "Target: 18 months runway"], layout: "titleContent" },
      { title: "Thank You", content: ["hello@yourcompany.com"], layout: "closing" },
    ],
  },
  {
    id: "lesson-plan",
    name: "Lesson Plan",
    description: "Educational presentation with objectives, content, activities, and assessment",
    icon: "book",
    slides: [
      { title: "", content: ["Lesson Title"], layout: "title" },
      { title: "Learning Objectives", content: ["Understand key concepts", "Apply knowledge to real scenarios", "Evaluate different approaches"], layout: "numberedSteps" },
      { title: "Agenda", content: ["Introduction (5 min)", "Core content (15 min)", "Activity (10 min)", "Q&A (5 min)"], layout: "timeline" },
      { title: "Key Concept 1", content: ["Definition and explanation", "Real-world example", "Why it matters"], layout: "titleContent" },
      { title: "Key Concept 2", content: ["Builds on concept 1", "Additional details", "Common misconceptions"], layout: "titleContent" },
      { title: "Comparison", content: ["Approach A|Pros: Simple\nPros: Fast\nCons: Limited\n\nApproach B|Pros: Flexible\nPros: Powerful\nCons: Complex"], layout: "comparison" },
      { title: "Hands-On Activity", content: ["Work in pairs", "Apply concepts to case study", "Prepare 2-minute share"], layout: "titleContent" },
      { title: "Key Takeaways", content: ["Remember these 3 things", "Connect to previous lessons", "Practice before next class"], layout: "titleContent" },
      { title: "Questions?", content: ["Raise hand or type in chat"], layout: "closing" },
    ],
  },
  {
    id: "quarterly-report",
    name: "Quarterly Report",
    description: "Business review with metrics, highlights, challenges, and next quarter goals",
    icon: "chart",
    slides: [
      { title: "", content: ["Q1 2025 Business Review"], layout: "title" },
      { title: "Executive Summary", content: ["Strong quarter across all metrics", "Exceeded revenue targets by 12%", "Launched 3 new features", "Expanded to 2 new markets"], layout: "titleContent" },
      { title: "Revenue Highlights", content: ["2.4M|Revenue", "12|Percent QoQ Growth", "890K|ARR Run Rate", "94|Percent Client Retention"], layout: "stats" },
      { title: "Key Metrics", content: ["15000|Active Users", "340|New Customers", "4.7|NPS Score", "18|Percent Churn Reduction"], layout: "stats" },
      { title: "Timeline", content: ["January|Launched v2.0\nHired 5 engineers\n\nFebruary|Series A closed\nNew enterprise deal\n\nMarch|API released\nPartner program live"], layout: "timeline" },
      { title: "Challenges", content: ["Hiring pace slower than planned", "Infrastructure costs above budget", "Competitor launched similar feature"], layout: "titleContent" },
      { title: "Next Quarter Goals", content: ["Reach $1M ARR", "Hire 8 engineers", "Launch mobile app", "Close 3 enterprise deals"], layout: "numberedSteps" },
      { title: "Thank You", content: ["Questions? Contact: finance@company.com"], layout: "closing" },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Announce a new product with features, benefits, and go-to-market plan",
    icon: "zap",
    slides: [
      { title: "", content: ["Introducing Product Name"], layout: "title" },
      { title: "Why We Built This", content: ["Customers needed a better way", "Existing solutions fall short", "The market is ready for change"], layout: "titleContent" },
      { title: "The Problem Today", content: ["Manual processes waste time", "Too many tools to manage", "Data scattered everywhere"], layout: "titleContent" },
      { title: "Our Solution", content: ["One platform for everything", "AI-powered automation", "Real-time collaboration"], layout: "titleContent" },
      { title: "Key Features", content: ["Feature 1|Smart automation\nSaves 10 hours/week\n\nFeature 2|Unified dashboard\nOne view for all data\n\nFeature 3|Team collaboration\nReal-time sync\n\nFeature 4|Enterprise security\nSOC 2 compliant"], layout: "comparison" },
      { title: "How It Works", content: ["Step 1: Connect your tools", "Step 2: Set up workflows", "Step 3: Let AI handle the rest"], layout: "numberedSteps" },
      { title: "Pricing", content: ["Free tier for individuals", "Pro at $29/month", "Enterprise custom pricing"], layout: "titleContent" },
      { title: "Early Results", content: ["92|Percent Time Saved", "3x|Productivity Boost", "98|Percent Customer Satisfaction"], layout: "stats" },
      { title: "Get Started Today", content: ["Try free at product.com", "No credit card required"], layout: "closing" },
    ],
  },
  {
    id: "company-overview",
    name: "Company Overview",
    description: "Professional company introduction for investors, partners, or new hires",
    icon: "building",
    slides: [
      { title: "", content: ["Company Name"], layout: "title" },
      { title: "Who We Are", content: ["Founded in 2020", "Team of 50+", "Serving 500+ clients globally"], layout: "titleContent" },
      { title: "Our Mission", content: ["To empower businesses with intelligent automation"], layout: "quote" },
      { title: "What We Do", content: ["AI-powered workflow automation", "Enterprise data integration", "Custom analytics dashboards"], layout: "titleContent" },
      { title: "By the Numbers", content: ["500|Clients", "50|Team Members", "12|Countries", "99.9|Percent Uptime"], layout: "stats" },
      { title: "Our Journey", content: ["2020|Founded in garage\n3 co-founders\n\n2021|Seed round raised\nFirst 10 clients\n\n2022|Series A\nTeam grows to 20\n\n2023|100 clients milestone\nInternational expansion\n\n2024|Series B\n500+ clients"], layout: "timeline" },
      { title: "Our Values", content: ["Customer obsession", "Build with integrity", "Move fast, learn faster"], layout: "titleContent" },
      { title: "Thank You", content: ["contact@company.com"], layout: "closing" },
    ],
  },
  {
    id: "research-presentation",
    name: "Research Presentation",
    description: "Academic or research findings with methodology, results, and conclusions",
    icon: "microscope",
    slides: [
      { title: "", content: ["Research Title"], layout: "title" },
      { title: "Research Question", content: ["What problem are we solving?", "Why does it matter?"], layout: "titleContent" },
      { title: "Background", content: ["Existing literature gap", "Previous approaches", "Our hypothesis"], layout: "titleContent" },
      { title: "Methodology", content: ["Step 1: Literature review", "Step 2: Data collection (n=500)", "Step 3: Statistical analysis", "Step 4: Validation"], layout: "numberedSteps" },
      { title: "Study Design", content: ["Control Group|n=250\nStandard approach\nBaseline measurements\n\nTreatment Group|n=250\nNew intervention\nPre/post measurements"], layout: "comparison" },
      { title: "Key Findings", content: ["42|Percent Improvement", "p < 0.001|Statistical Significance", "0.85|Effect Size (Cohen's d)"], layout: "stats" },
      { title: "Results", content: ["Finding 1 confirms hypothesis", "Finding 2 reveals unexpected pattern", "Finding 3 opens new research direction"], layout: "titleContent" },
      { title: "Implications", content: ["Practical applications", "Theoretical contributions", "Limitations and future work"], layout: "titleContent" },
      { title: "References & Contact", content: ["Full paper available at DOI link", "Email: researcher@university.edu"], layout: "closing" },
    ],
  },
]

export function getTemplateById(id: string): PresentationTemplate | undefined {
  return presentationTemplates.find(t => t.id === id)
}
