"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AgentsService, BusinessAnalysisRequest } from "@/lib/api"
import {
  Brain,
  Building2,
  Target,
  DollarSign,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react"

interface BusinessProfile {
  industry: string
  companySize: string
  revenue: string
  goals: string[]
  challenges: string[]
  currentSystems: string[]
  timeline: string
  budget: string
}

interface InterviewQuestion {
  id: string
  category: string
  question: string
  type: "text" | "select" | "multiselect" | "textarea"
  options?: string[]
  required: boolean
  answered: boolean
  answer?: string | string[]
}

export function BusinessIntelligencePanel() {
  const [currentStep, setCurrentStep] = useState<"interview" | "analysis" | "recommendations">("interview")
  const [interviewProgress, setInterviewProgress] = useState(0)
  const [businessProfile, setBusinessProfile] = useState<Partial<BusinessProfile>>({})
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const [questions] = useState<InterviewQuestion[]>([
    {
      id: "industry",
      category: "Company Profile",
      question: "What industry does your company operate in?",
      type: "select",
      options: ["E-commerce", "SaaS", "Manufacturing", "Healthcare", "Finance", "Education", "Other"],
      required: true,
      answered: false,
    },
    {
      id: "size",
      category: "Company Profile",
      question: "How many employees does your company have?",
      type: "select",
      options: ["1-10", "11-50", "51-200", "201-1000", "1000+"],
      required: true,
      answered: false,
    },
    {
      id: "revenue",
      category: "Company Profile",
      question: "What is your annual revenue range?",
      type: "select",
      options: ["< $1M", "$1M - $10M", "$10M - $50M", "$50M - $100M", "$100M+"],
      required: true,
      answered: false,
    },
    {
      id: "goals",
      category: "Business Objectives",
      question: "What are your primary business goals? (Select all that apply)",
      type: "multiselect",
      options: [
        "Increase revenue",
        "Reduce costs",
        "Improve efficiency",
        "Enhance customer experience",
        "Scale operations",
        "Digital transformation",
      ],
      required: true,
      answered: false,
    },
    {
      id: "challenges",
      category: "Business Objectives",
      question: "What are your biggest operational challenges?",
      type: "textarea",
      required: true,
      answered: false,
    },
    {
      id: "systems",
      category: "Current Infrastructure",
      question: "What systems and tools do you currently use?",
      type: "textarea",
      required: true,
      answered: false,
    },
    {
      id: "timeline",
      category: "Project Requirements",
      question: "What is your desired timeline for implementation?",
      type: "select",
      options: ["1-3 months", "3-6 months", "6-12 months", "12+ months"],
      required: true,
      answered: false,
    },
    {
      id: "budget",
      category: "Project Requirements",
      question: "What is your budget range for this automation project?",
      type: "select",
      options: ["< $10K", "$10K - $50K", "$50K - $100K", "$100K - $500K", "$500K+"],
      required: true,
      answered: false,
    },
  ])

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})

  const handleAnswer = (questionId: string, answer: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))

    // Update progress
    const answeredCount = Object.keys({ ...answers, [questionId]: answer }).length
    setInterviewProgress((answeredCount / questions.length) * 100)
  }

  const nextQuestion = async () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    } else {
      // Interview complete, start analysis
      setIsAnalyzing(true)
      setAnalysisError(null)

      try {
        // Prepare responses for API
        const responses: Record<string, string> = {}
        Object.entries(answers).forEach(([key, value]) => {
          responses[key] = Array.isArray(value) ? value.join(', ') : String(value)
        })

        // Call real API for business analysis
        const analysisRequest: BusinessAnalysisRequest = { responses }
        const result = await AgentsService.analyzeBusinessNeeds(analysisRequest)

        if (result.success && result.analysis) {
          setAnalysisResult(result.analysis)
          setCurrentStep("analysis")
          generateBusinessProfile()
        } else {
          throw new Error(result.error || 'Analysis failed')
        }
      } catch (error) {
        console.error('Business analysis error:', error)
        setAnalysisError(error instanceof Error ? error.message : 'Analysis failed')
        // Fallback to local analysis
        setCurrentStep("analysis")
        generateBusinessProfile()
      } finally {
        setIsAnalyzing(false)
      }
    }
  }

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const generateBusinessProfile = () => {
    const profile: BusinessProfile = {
      industry: (answers.industry as string) || "Unknown",
      companySize: (answers.size as string) || "Unknown",
      revenue: (answers.revenue as string) || "Unknown",
      goals: Array.isArray(answers.goals) ? answers.goals : [(answers.goals as string) || ""],
      challenges: [(answers.challenges as string) || ""],
      currentSystems: [(answers.systems as string) || ""],
      timeline: (answers.timeline as string) || "Unknown",
      budget: (answers.budget as string) || "Unknown",
    }
    setBusinessProfile(profile)
  }

  const generateRecommendations = () => {
    setCurrentStep("recommendations")
  }

  const currentQuestion = questions[currentQuestionIndex]
  const isCurrentAnswered = answers[currentQuestion?.id]

  if (isAnalyzing) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="text-center">
          <Brain className="h-12 w-12 text-accent mx-auto mb-4" />
          <CardTitle>Analyzing Business Intelligence</CardTitle>
          <CardDescription>Processing your responses to generate personalized recommendations...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={66} className="w-full" />
          <div className="text-center text-sm text-muted-foreground">
            Analyzing business profile and generating automation strategy...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-accent" />
            Business Intelligence Interview
          </CardTitle>
          <CardDescription>Help us understand your business to create the perfect automation strategy</CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={currentStep} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="interview" disabled={currentStep !== "interview"}>
            Interview
          </TabsTrigger>
          <TabsTrigger value="analysis" disabled={currentStep === "interview"}>
            Analysis
          </TabsTrigger>
          <TabsTrigger value="recommendations" disabled={currentStep !== "recommendations"}>
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="interview" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </CardTitle>
                  <CardDescription>{currentQuestion?.category}</CardDescription>
                </div>
                <Badge variant="outline">{Math.round(interviewProgress)}% Complete</Badge>
              </div>
              <Progress value={interviewProgress} className="w-full" />
            </CardHeader>
            <CardContent className="space-y-6">
              {currentQuestion && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">{currentQuestion.question}</Label>

                  {currentQuestion.type === "text" && (
                    <Input
                      value={(answers[currentQuestion.id] as string) || ""}
                      onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                      placeholder="Enter your answer..."
                    />
                  )}

                  {currentQuestion.type === "textarea" && (
                    <Textarea
                      value={(answers[currentQuestion.id] as string) || ""}
                      onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                      placeholder="Describe in detail..."
                      rows={4}
                    />
                  )}

                  {currentQuestion.type === "select" && (
                    <Select
                      value={(answers[currentQuestion.id] as string) || ""}
                      onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option..." />
                      </SelectTrigger>
                      <SelectContent>
                        {currentQuestion.options?.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {currentQuestion.type === "multiselect" && (
                    <div className="space-y-2">
                      {currentQuestion.options?.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={option}
                            checked={
                              Array.isArray(answers[currentQuestion.id]) &&
                              (answers[currentQuestion.id] as string[]).includes(option)
                            }
                            onChange={(e) => {
                              const currentAnswers = (answers[currentQuestion.id] as string[]) || []
                              if (e.target.checked) {
                                handleAnswer(currentQuestion.id, [...currentAnswers, option])
                              } else {
                                handleAnswer(
                                  currentQuestion.id,
                                  currentAnswers.filter((a) => a !== option),
                                )
                              }
                            }}
                            className="rounded border-border"
                          />
                          <Label htmlFor={option} className="text-sm">
                            {option}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={previousQuestion} disabled={currentQuestionIndex === 0}>
                  Previous
                </Button>
                <Button onClick={nextQuestion} disabled={!isCurrentAnswered}>
                  {currentQuestionIndex === questions.length - 1 ? "Complete Interview" : "Next"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  Company Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Industry:</span>
                  <Badge variant="outline">{businessProfile.industry}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Size:</span>
                  <Badge variant="outline">{businessProfile.companySize}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Revenue:</span>
                  <Badge variant="outline">{businessProfile.revenue}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Timeline:</span>
                  <Badge variant="outline">{businessProfile.timeline}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-accent" />
                  Business Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {businessProfile.goals?.map((goal, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">{goal}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>AI-Generated Business Analysis</CardTitle>
              <CardDescription>
                {analysisError ? 'Using fallback analysis - API connection failed' : 'Based on your responses, here\'s our AI analysis'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysisError && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      API Analysis Error: {analysisError}. Showing fallback analysis.
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-500">
                    {analysisResult?.priority === 'high' ? 'High' : analysisResult?.priority === 'medium' ? 'Medium' : 'High'}
                  </div>
                  <div className="text-sm text-muted-foreground">Automation Potential</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <DollarSign className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-500">$2.3M</div>
                  <div className="text-sm text-muted-foreground">Estimated Annual Savings</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Clock className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-purple-500">6 months</div>
                  <div className="text-sm text-muted-foreground">Recommended Timeline</div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">
                  {analysisResult ? 'AI Analysis Summary:' : 'Key Insights:'}
                </h4>

                {analysisResult ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900">{analysisResult.summary}</p>
                    </div>

                    {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-medium text-sm">AI Recommendations:</h5>
                        {analysisResult.recommendations.map((recommendation: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                            <span className="text-sm">{recommendation}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      <span className="text-sm">
                        Your {businessProfile.industry} business shows high potential for customer onboarding automation
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      <span className="text-sm">
                        Current systems integration will reduce implementation complexity by 40%
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                      <span className="text-sm">
                        Manual processes identified that could benefit from immediate automation
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <Button onClick={generateRecommendations} className="w-full">
                Generate Automation Recommendations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent" />
                Personalized Automation Strategy
              </CardTitle>
              <CardDescription>Custom recommendations based on your business profile</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Phase 1: Quick Wins (Month 1-2)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Automate customer welcome emails</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Setup lead scoring automation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Integrate CRM with existing tools</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Phase 2: Core Systems (Month 3-4)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Customer onboarding workflow</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Automated support ticket routing</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Sales pipeline automation</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Recommended Agent Configuration:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-sm">Intent Agent</div>
                    <div className="text-xs text-muted-foreground">Customer inquiry classification</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-sm">Workflow Agent</div>
                    <div className="text-xs text-muted-foreground">Onboarding orchestration</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="font-medium text-sm">Tool Agent</div>
                    <div className="text-xs text-muted-foreground">CRM and email integration</div>
                  </div>
                </div>
              </div>

              <Button className="w-full" size="lg">
                Start Implementation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
