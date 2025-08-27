'use client'

import { useState } from 'react'
import Link from 'next/link'
// import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: 'general' | 'pricing' | 'technical' | 'security'
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: 'AI秘書システムとは何ですか？',
    answer: 'AI秘書システムは、経営者と従業員の間のコミュニケーションを効率化するLINEベースのAIアシスタントです。従業員からの報告を自動分析し、重要度に応じて経営者に通知します。また、経営者からの指示を従業員に適切な形で伝達します。',
    category: 'general'
  },
  {
    id: '2',
    question: '利用料金はいくらですか？',
    answer: 'ベーシックプラン（月額5,000円）、プレミアムプラン（月額20,000円）、エンタープライズプラン（月額50,000円）をご用意しています。14日間の無料トライアルもございます。',
    category: 'pricing'
  },
  {
    id: '3',
    question: 'どのように始めればよいですか？',
    answer: '1. 公式サイトから無料登録\n2. LINEでAI秘書を友達追加\n3. 会社情報を設定\n4. 従業員を招待\n5. すぐに利用開始！',
    category: 'general'
  },
  {
    id: '4',
    question: 'データのセキュリティは大丈夫ですか？',
    answer: '企業データは完全に分離されており、他社のデータと混在することはありません。また、通信は全て暗号化され、厳格なアクセス制御により保護されています。',
    category: 'security'
  },
  {
    id: '5',
    question: '何名まで利用できますか？',
    answer: 'プランにより異なります。ベーシックプランは20名まで、プレミアムプランは100名まで、エンタープライズプランは無制限です。',
    category: 'pricing'
  },
  {
    id: '6',
    question: 'AIの精度はどの程度ですか？',
    answer: 'GPT-4を使用し、90%以上の精度で重要度判定を行います。使用を続けるほど、お客様の会社に特化した学習を行い、精度が向上します。',
    category: 'technical'
  },
  {
    id: '7',
    question: 'LINE以外のツールとも連携できますか？',
    answer: 'Googleカレンダー、Slack、Microsoft Teams等との連携を予定しています。詳細は営業担当までお問い合わせください。',
    category: 'technical'
  },
  {
    id: '8',
    question: 'サポート体制について教えてください',
    answer: '平日9:00-18:00でメールサポートを提供しています。プレミアムプラン以上では電話サポートもご利用いただけます。',
    category: 'general'
  },
  {
    id: '9',
    question: '契約期間の縛りはありますか？',
    answer: '最低契約期間は1ヶ月です。いつでも解約可能で、解約料は一切かかりません。',
    category: 'pricing'
  },
  {
    id: '10',
    question: '個人情報の取り扱いについて',
    answer: 'プライバシーポリシーに基づき、厳格に管理しています。個人情報は業務目的以外では使用せず、第三者への提供は行いません。',
    category: 'security'
  }
]

const categories = {
  general: { name: '一般的な質問', icon: '❓' },
  pricing: { name: '料金について', icon: '💰' },
  technical: { name: '技術仕様', icon: '⚙️' },
  security: { name: 'セキュリティ', icon: '🔒' }
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const toggleItem = (id: string) => {
    setOpenItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const filteredFAQs = faqData.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch = searchQuery === '' || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">よくある質問</h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2">AI秘書システムに関するご質問にお答えします</p>
            </div>
            <Link
              href="/lp"
              className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white text-sm sm:text-base rounded-lg hover:bg-blue-700 transition-colors"
            >
              戻る
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Search and Filter */}
        <div className="mb-6 sm:mb-8">
          <div className="relative mb-4 sm:mb-6">
            <input
              type="text"
              placeholder="質問を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-full transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border'
              }`}
            >
              すべて
            </button>
            {Object.entries(categories).map(([key, category]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-full transition-colors flex items-center gap-1 sm:gap-2 ${
                  selectedCategory === key
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border'
                }`}
              >
                <span>{category.icon}</span>
                <span className="hidden sm:inline">{category.name}</span>
                <span className="sm:hidden">{category.name.split('について')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3 sm:space-y-4">
          {filteredFAQs.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border">
              <button
                onClick={() => toggleItem(item.id)}
                className="w-full px-4 sm:px-6 py-4 sm:py-5 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                  <span className="text-lg sm:text-xl flex-shrink-0 mt-1">
                    {categories[item.category].icon}
                  </span>
                  <h3 className="text-sm sm:text-lg font-medium text-gray-900 leading-tight sm:leading-normal">
                    {item.question}
                  </h3>
                </div>
                <div className="flex-shrink-0 ml-2">
                  {openItems.includes(item.id) ? (
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </button>
              
              {openItems.includes(item.id) && (
                <div className="px-4 sm:px-6 pb-4 sm:pb-5">
                  <div className="pl-8 sm:pl-12">
                    <div className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-line">
                      {item.answer}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredFAQs.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <div className="text-gray-400 text-4xl sm:text-6xl mb-3 sm:mb-4">🔍</div>
            <h3 className="text-lg sm:text-xl font-medium text-gray-600 mb-2">該当する質問が見つかりませんでした</h3>
            <p className="text-sm sm:text-base text-gray-500 mb-6 sm:mb-8">検索条件を変更してお試しください</p>
          </div>
        )}

        {/* Contact Section */}
        <div className="mt-8 sm:mt-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 sm:p-8 text-center text-white">
          <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">
            他にご質問はありませんか？
          </h2>
          <p className="text-sm sm:text-base text-blue-100 mb-6">
            お困りのことがあれば、お気軽にお問い合わせください
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link
              href="/executive/register"
              className="px-6 sm:px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              無料で始める
            </Link>
            <a
              href="mailto:support@ai-secretary.com"
              className="px-6 sm:px-8 py-3 bg-transparent border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              お問い合わせ
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}