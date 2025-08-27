'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface ChatMessage {
  id: string
  sender: 'user' | 'ai' | 'executive'
  name: string
  message: string
  timestamp: string
  type?: 'normal' | 'urgent' | 'notification' | 'thinking'
}

const scenarios = {
  employee: {
    title: '従業員とAI秘書のやりとり',
    description: '従業員が報告・質問すると、AI秘書が優先度を判定し、経営者に通知します',
    initialMessages: [
      {
        id: '1',
        sender: 'user' as const,
        name: '田中（営業部）',
        message: 'お疲れ様です。大口顧客のA商事様から、来月のプロジェクト予算を20%削減したいというご相談がありました。どう対応すべきでしょうか？',
        timestamp: '14:30',
        type: 'normal' as const
      }
    ]
  },
  executive: {
    title: '経営者とAI秘書のやりとり',
    description: '経営者の指示をAI秘書が従業員に丁寧に伝達し、進捗を管理します',
    initialMessages: [
      {
        id: '1',
        sender: 'user' as const,
        name: '山田社長',
        message: '田中にA商事の件で代替案3つ、明日の午前中までに',
        timestamp: '15:45',
        type: 'normal' as const
      }
    ]
  },
  proactive: {
    title: 'プロアクティブAI機能',
    description: 'AI秘書が経営者の思考パターンを学習し、従業員の質問に先回りして回答を提案します',
    initialMessages: [
      {
        id: '1',
        sender: 'user' as const,
        name: '佐藤（企画部）',
        message: '新サービスのマーケティング予算について相談があります。競合他社が同様のサービスを開始しており、予算を増額すべきか迷っています。',
        timestamp: '16:20',
        type: 'normal' as const
      }
    ]
  }
}

export default function DemoPage() {
  const [currentScenario, setCurrentScenario] = useState<keyof typeof scenarios>('employee')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isPlaying, setIsPlaying] = useState(false)

  const demoSteps = {
    employee: [
      {
        id: '2',
        sender: 'ai' as const,
        name: 'AI秘書',
        message: '田中様、ご報告ありがとうございます。\n\n「A商事様からの予算削減相談」について承りました。\n\n📌 重要案件として優先的に処理いたします。経営者に通知いたします。',
        timestamp: '14:31',
        type: 'normal' as const
      },
      {
        id: '3',
        sender: 'ai' as const,
        name: 'AI秘書',
        message: '🚨 【経営者通知】\n\n報告者: 田中（営業部）\n\n【要約】\nA商事様から予算20%削減の相談\n\n【詳細】\n大口顧客のA商事様から、来月のプロジェクト予算を20%削減したいというご相談\n\n【推奨アクション】\n代替案の検討と提示が必要',
        timestamp: '14:31',
        type: 'urgent' as const
      }
    ],
    executive: [
      {
        id: '2',
        sender: 'ai' as const,
        name: 'AI秘書',
        message: '承知いたしました。田中様（営業部）に以下のメッセージを送信しました：\n\n【田中様への送信内容】\n「お疲れ様です。山田社長より依頼がございます。\n\nA商事様の件につきまして、代替案を3つご用意いただけますでしょうか。\n明日の午前中までにメールでご送付いただければ幸いです。\n\nお忙しい中恐れ入りますが、どうぞよろしくお願いいたします。」',
        timestamp: '15:46',
        type: 'notification' as const
      },
      {
        id: '3',
        sender: 'ai' as const,
        name: 'AI秘書',
        message: '✓ 田中様がメッセージを確認しました\n\n送信: 15:46\n既読: 15:48\n\n田中様からの返信:\n「承知いたしました。明日午前中までに代替案3つをまとめてお送りします。」',
        timestamp: '15:48',
        type: 'notification' as const
      }
    ],
    proactive: [
      {
        id: '2',
        sender: 'ai' as const,
        name: 'AI秘書',
        message: '佐藤様、ご相談ありがとうございます。\n\n「新サービスのマーケティング予算増額検討」について承りました。\n\n📌 重要案件として経営者に報告いたします。',
        timestamp: '16:21',
        type: 'normal' as const
      },
      {
        id: '3',
        sender: 'ai' as const,
        name: 'AI秘書',
        message: '🧠 **経営者の思考パターンからの推測**\n\n「競合対応は迅速に。ただし、ROIの明確な根拠が必要。まず市場調査データを集めて、3ヶ月後の売上予測を立ててから判断する」\n\n※過去のパターンに基づく推測です\n\n経営者からの正式な指示をお待ちください。',
        timestamp: '16:22',
        type: 'thinking' as const
      }
    ]
  }

  useEffect(() => {
    setMessages(scenarios[currentScenario].initialMessages)
    setIsPlaying(false)
  }, [currentScenario])

  const playDemo = () => {
    if (isPlaying) return
    setIsPlaying(true)

    const steps = demoSteps[currentScenario]
    steps.forEach((step, index) => {
      setTimeout(() => {
        setMessages(prev => [...prev, step])
        if (index === steps.length - 1) {
          setIsPlaying(false)
        }
      }, (index + 1) * 2000)
    })
  }

  const resetDemo = () => {
    setMessages(scenarios[currentScenario].initialMessages)
    setIsPlaying(false)
  }

  const getMessageStyle = (type?: string) => {
    switch (type) {
      case 'urgent':
        return 'bg-red-50 border-l-4 border-red-500'
      case 'notification':
        return 'bg-blue-50 border-l-4 border-blue-500'
      case 'thinking':
        return 'bg-purple-50 border-l-4 border-purple-500'
      default:
        return 'bg-white'
    }
  }

  const getSenderColor = (sender: string) => {
    switch (sender) {
      case 'user':
        return 'text-green-600'
      case 'ai':
        return 'text-blue-600'
      case 'executive':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI秘書デモ</h1>
              <p className="text-gray-600 mt-2">実際のやりとりを体験してみてください</p>
            </div>
            <Link
              href="/lp"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              戻る
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Scenario Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">シナリオを選択</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(scenarios).map(([key, scenario]) => (
              <button
                key={key}
                onClick={() => setCurrentScenario(key as keyof typeof scenarios)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  currentScenario === key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <h3 className="font-semibold text-gray-900 mb-2">{scenario.title}</h3>
                <p className="text-sm text-gray-600">{scenario.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Chat Demo */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden order-2 lg:order-1">
            <div className="bg-green-500 text-white px-4 py-3 flex items-center">
              <div className="w-3 h-3 bg-white rounded-full mr-3"></div>
              <span className="font-medium text-sm sm:text-base">AI秘書</span>
            </div>
            
            <div className="h-80 sm:h-96 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`p-2 sm:p-3 rounded-lg transition-all duration-300 ${
                    message.sender === 'user' 
                      ? 'ml-auto max-w-[85%] sm:max-w-xs bg-green-500 text-white'
                      : `mr-auto max-w-[90%] sm:max-w-sm ${getMessageStyle(message.type)}`
                  }`}
                  style={{
                    opacity: isPlaying && index >= scenarios[currentScenario].initialMessages.length ? 0.8 : 1,
                    transform: isPlaying && index >= scenarios[currentScenario].initialMessages.length 
                      ? 'translateY(-5px)' : 'translateY(0)',
                  }}
                >
                  {message.sender !== 'user' && (
                    <div className={`text-xs font-medium mb-1 ${getSenderColor(message.sender)}`}>
                      {message.name}
                    </div>
                  )}
                  <div className="text-xs sm:text-sm whitespace-pre-line leading-relaxed">{message.message}</div>
                  <div className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-green-100' : 'text-gray-500'
                  }`}>
                    {message.timestamp}
                  </div>
                </div>
              ))}
              {isPlaying && (
                <div className="flex items-center text-gray-500 text-sm">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce mr-1" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <span className="ml-2">AI秘書が入力中...</span>
                </div>
              )}
            </div>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <button
                  onClick={playDemo}
                  disabled={isPlaying}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPlaying ? 'デモ実行中...' : 'デモを開始'}
                </button>
                <button
                  onClick={resetDemo}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  リセット
                </button>
              </div>
            </div>
          </div>

          {/* Explanation Panel */}
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 order-1 lg:order-2">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
              {scenarios[currentScenario].title}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
              {scenarios[currentScenario].description}
            </p>

            <div className="space-y-4">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium text-gray-900">1. メッセージ受信</h4>
                <p className="text-sm text-gray-600">
                  従業員からのメッセージをLINEで受信
                </p>
              </div>
              
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium text-gray-900">2. AI分析</h4>
                <p className="text-sm text-gray-600">
                  GPT-4が内容を分析し、優先度を自動判定
                </p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-medium text-gray-900">3. 自動処理</h4>
                <p className="text-sm text-gray-600">
                  {currentScenario === 'employee' && '重要案件は経営者に即座通知'}
                  {currentScenario === 'executive' && '従業員への指示を自動転送'}
                  {currentScenario === 'proactive' && 'AI学習により経営者の思考を予測'}
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">💡 ポイント</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                {currentScenario === 'employee' && (
                  <>
                    <li>• 緊急度を4段階で自動判定</li>
                    <li>• 重要案件のみ経営者に通知</li>
                    <li>• 24時間365日対応可能</li>
                  </>
                )}
                {currentScenario === 'executive' && (
                  <>
                    <li>• 指示内容を自動解析</li>
                    <li>• 適切な従業員に自動転送</li>
                    <li>• 既読・返信状況を追跡</li>
                  </>
                )}
                {currentScenario === 'proactive' && (
                  <>
                    <li>• 経営者の過去の判断を学習</li>
                    <li>• 思考パターンから回答を予測</li>
                    <li>• 先回りした提案で時短効果</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">
            この効果を、あなたの会社でも体験してみませんか？
          </h2>
          <p className="text-blue-100 mb-6">
            無料トライアルで、実際の効果を確認できます
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/executive/register"
              className="px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              無料で始める
            </Link>
            <Link
              href="/lp"
              className="px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              詳細を見る
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}