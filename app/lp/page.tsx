'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [scrollY, setScrollY] = useState(0)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % 3)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const features = [
    {
      title: 'AI優先度判定',
      icon: '🧠',
      description: '最新のGPT-4が、メッセージの緊急度を4段階で瞬時に判定',
      details: [
        '24時間365日稼働',
        '学習機能で精度向上',
        'カスタマイズ可能な判定基準'
      ]
    },
    {
      title: 'スマート通知',
      icon: '🔔',
      description: '本当に必要な時だけ、最適な方法でお知らせ',
      details: [
        '緊急度に応じた通知方法',
        '営業時間外の制御',
        '通知のグルーピング機能'
      ]
    },
    {
      title: '統合ダッシュボード',
      icon: '📊',
      description: '組織の情報を一元管理、瞬時に状況把握',
      details: [
        '全体状況の可視化',
        'トレンド分析',
        'レポート自動生成'
      ]
    },
    {
      title: '完全クラウド',
      icon: '☁️',
      description: 'インストール不要、どこからでもアクセス可能',
      details: [
        'ゼロメンテナンス',
        '自動アップデート',
        '堅牢なセキュリティ'
      ]
    }
  ]

  const testimonials = [
    {
      company: '製造業 A社',
      logo: '🏭',
      metrics: [
        { label: '緊急対応時間', value: '72時間→3時間', highlight: '95%短縮' },
        { label: '経営者の休日出勤', value: '月8回→月1回', highlight: '87.5%削減' },
        { label: 'ROI', value: '導入3ヶ月で投資回収', highlight: '300%' }
      ],
      quote: '情報の優先順位が明確になり、本当に重要な決定に集中できるようになりました。'
    },
    {
      company: 'サービス業 B社',
      logo: '🏢',
      metrics: [
        { label: '重要案件の見逃し', value: '月5件→0件', highlight: '100%改善' },
        { label: '意思決定スピード', value: '3倍向上', highlight: '300%' },
        { label: '従業員満足度', value: '23%向上', highlight: '+23%' }
      ],
      quote: 'AIが情報を整理してくれるので、経営判断に必要な時間が大幅に削減されました。'
    },
    {
      company: 'IT企業 C社',
      logo: '💻',
      metrics: [
        { label: '情報処理時間', value: '1日3時間→30分', highlight: '83%削減' },
        { label: 'プロジェクト遅延', value: '80%削減', highlight: '-80%' },
        { label: '売上', value: '前年比115%', highlight: '+15%' }
      ],
      quote: '重要な情報を見逃さなくなったことで、ビジネスチャンスを確実に掴めるようになりました。'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-50 opacity-70"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight">
            もう、休日の電話に<br />
            <span className="text-blue-600">怯えなくていい。</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-700 mb-12 max-w-3xl mx-auto">
            AI秘書が、あなたの代わりに24時間365日情報を監視。<br />
            本当に緊急な案件だけを、確実にお知らせします。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-blue-600 text-white text-lg font-medium rounded-full hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
            >
              今すぐ無料で始める（最短10分）
            </Link>
            <button className="px-8 py-4 bg-white text-gray-800 text-lg font-medium rounded-full hover:bg-gray-50 transition-all border border-gray-300 shadow-md">
              資料をダウンロード
            </button>
          </div>
          
          <p className="mt-6 text-gray-600">
            クレジットカード不要・いつでも解約可能
          </p>
        </div>
        
        <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            経営者の97%が抱える、<br className="sm:hidden" />情報管理の悩み
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16">
            あなたも、こんな課題を感じていませんか？
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg transform transition-all hover:scale-105">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                重要な連絡が埋もれてしまう
              </h3>
              <p className="text-gray-600">
                日々大量のメッセージの中から、本当に重要なものを見つけ出すのは至難の業
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-lg transform transition-all hover:scale-105">
              <div className="text-4xl mb-4">⏰</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                24時間気が休まらない
              </h3>
              <p className="text-gray-600">
                休日でも緊急連絡が気になり、真の意味でのリフレッシュができない
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-lg transform transition-all hover:scale-105">
              <div className="text-4xl mb-4">💸</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                対応の遅れによる機会損失
              </h3>
              <p className="text-gray-600">
                重要な判断の遅れが、年間数千万円規模の損失につながることも
              </p>
            </div>
          </div>
          
          {/* Data Visualization */}
          <div className="mt-16 bg-white p-8 rounded-2xl shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-4xl font-bold text-blue-600 mb-2">300件</div>
                <p className="text-gray-600">経営者の1日の平均情報量</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-red-600 mb-2">3%</div>
                <p className="text-gray-600">本当に緊急な案件の割合</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-orange-600 mb-2">2,400万円</div>
                <p className="text-gray-600">見逃しによる年間平均損失額</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            AIが、あなたの<span className="text-blue-600">最強の右腕</span>になる
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16">
            シンプルな3ステップで、情報管理が劇的に改善
          </p>
          
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                  1️⃣
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">受信</h3>
                <p className="text-gray-600">
                  従業員がLINEで<br />メッセージ送信
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                  2️⃣
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">分析</h3>
                <p className="text-gray-600">
                  AI（GPT-4）が瞬時に<br />優先度を判定
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
                  3️⃣
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">通知</h3>
                <p className="text-gray-600">
                  緊急案件のみ<br />経営者に即座アラート
                </p>
              </div>
            </div>
            
            {/* Connecting arrows */}
            <div className="hidden md:block absolute top-24 left-1/3 w-1/3 h-0.5 bg-gradient-to-r from-blue-300 to-blue-400"></div>
            <div className="hidden md:block absolute top-24 right-1/3 w-1/3 h-0.5 bg-gradient-to-r from-blue-400 to-blue-500"></div>
          </div>
          
          {/* Screenshot Section */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-50 p-4 rounded-lg shadow-md">
              <div className="bg-white rounded-lg p-6">
                <div className="text-sm text-gray-500 mb-2">LINE通知画面</div>
                <div className="bg-green-50 p-4 rounded-lg mb-2">
                  <div className="text-sm text-gray-700">AI秘書より</div>
                  <div className="mt-2 text-gray-900">
                    🚨 緊急案件<br />
                    「システム障害発生、顧客影響あり」<br />
                    即座の対応が必要です。
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg shadow-md">
              <div className="bg-white rounded-lg p-6">
                <div className="text-sm text-gray-500 mb-2">管理ダッシュボード</div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                    <span className="text-sm font-medium">緊急</span>
                    <span className="text-red-600 font-bold">2件</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                    <span className="text-sm font-medium">高</span>
                    <span className="text-orange-600 font-bold">5件</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                    <span className="text-sm font-medium">通常</span>
                    <span className="text-blue-600 font-bold">23件</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            シンプルだから、続く。<br />
            強力だから、効果が出る。
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16">
            必要な機能をすべて、使いやすく実装
          </p>
          
          {/* Feature Tabs */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="flex flex-wrap border-b">
              {features.map((feature, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`flex-1 px-4 py-4 text-center font-medium transition-all ${
                    activeTab === index
                      ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl mr-2">{feature.icon}</span>
                  <span className="hidden sm:inline">{feature.title}</span>
                </button>
              ))}
            </div>
            
            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {features[activeTab].title}
              </h3>
              <p className="text-lg text-gray-600 mb-6">
                {features[activeTab].description}
              </p>
              <ul className="space-y-3">
                {features[activeTab].details.map((detail, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="w-6 h-6 text-green-500 mt-0.5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            導入企業の声
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16">
            数字が証明する、圧倒的な成果
          </p>
          
          <div className="relative bg-gray-50 rounded-2xl p-8 shadow-lg">
            <div className="absolute top-8 right-8 text-5xl opacity-20">
              {testimonials[currentTestimonial].logo}
            </div>
            
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              {testimonials[currentTestimonial].company}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {testimonials[currentTestimonial].metrics.map((metric, index) => (
                <div key={index} className="bg-white p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">{metric.label}</div>
                  <div className="text-lg font-medium text-gray-900">{metric.value}</div>
                  <div className="text-2xl font-bold text-blue-600 mt-2">{metric.highlight}</div>
                </div>
              ))}
            </div>
            
            <blockquote className="text-gray-700 italic text-lg">
              「{testimonials[currentTestimonial].quote}」
            </blockquote>
            
            {/* Carousel indicators */}
            <div className="flex justify-center mt-8 space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentTestimonial === index
                      ? 'w-8 bg-blue-600'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            秘書を雇うより、圧倒的にスマート
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16">
            一般的な秘書の月給：30万円〜 vs AI秘書：0円〜
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all hover:scale-105">
              <div className="bg-gray-50 px-6 py-4">
                <h3 className="text-xl font-bold text-gray-900">フリー</h3>
                <div className="mt-2">
                  <span className="text-4xl font-bold">¥0</span>
                  <span className="text-gray-600">/月</span>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">基本機能すべて</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">5ユーザーまで</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">月間1000メッセージ</span>
                  </li>
                </ul>
                <div className="text-sm text-gray-600 mb-4">
                  スタートアップに最適
                </div>
                <Link
                  href="/dashboard"
                  className="block w-full text-center px-4 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
                >
                  無料で始める
                </Link>
              </div>
            </div>
            
            {/* Standard Plan */}
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all hover:scale-105 border-2 border-blue-500">
              <div className="bg-blue-600 text-white px-6 py-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">スタンダード</h3>
                  <span className="bg-blue-500 px-3 py-1 rounded-full text-sm">人気</span>
                </div>
                <div className="mt-2">
                  <span className="text-4xl font-bold">¥29,800</span>
                  <span className="text-blue-100">/月</span>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">全機能利用可能</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">50ユーザーまで</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">無制限メッセージ</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">優先サポート</span>
                  </li>
                </ul>
                <div className="text-sm text-gray-600 mb-4">
                  中小企業に最適
                </div>
                <Link
                  href="/dashboard"
                  className="block w-full text-center px-4 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  1ヶ月無料で試す
                </Link>
              </div>
            </div>
            
            {/* Enterprise Plan */}
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all hover:scale-105">
              <div className="bg-gray-900 text-white px-6 py-4">
                <h3 className="text-xl font-bold">エンタープライズ</h3>
                <div className="mt-2">
                  <span className="text-4xl font-bold">¥98,000</span>
                  <span className="text-gray-400">/月</span>
                </div>
              </div>
              <div className="p-6">
                <ul className="space-y-3 mb-8">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">全機能 + カスタマイズ</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">無制限ユーザー</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">専任サポート</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700">SLA保証</span>
                  </li>
                </ul>
                <div className="text-sm text-gray-600 mb-4">
                  大企業に最適
                </div>
                <button className="block w-full text-center px-4 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors">
                  お問い合わせ
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
            最短10分。<br />
            今日から始められる業務改革
          </h2>
          <p className="text-xl text-gray-600 text-center mb-16">
            複雑な導入作業は一切不要
          </p>
          
          <div className="max-w-4xl mx-auto">
            <div className="space-y-8">
              {/* Step 1 */}
              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <div className="ml-6 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    申し込み（1分）
                  </h3>
                  <p className="text-gray-600">
                    フォームに必要事項を入力してアカウント作成
                  </p>
                  <div className="mt-3 bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">必要な情報</span>
                      <span className="text-sm font-medium">会社名、メールアドレス</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <div className="ml-6 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    設定（5分）
                  </h3>
                  <p className="text-gray-600">
                    LINE連携と通知設定、メンバー招待
                  </p>
                  <div className="mt-3 bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">LINE Bot追加（QRコード読み取り）</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">通知時間帯の設定</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm">チームメンバー招待</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="flex items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <div className="ml-6 flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    運用開始（4分）
                  </h3>
                  <p className="text-gray-600">
                    テスト送信して動作確認、すぐに利用開始
                  </p>
                  <div className="mt-3 bg-green-50 rounded-lg p-4">
                    <div className="flex items-center text-green-700">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">準備完了！</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            よくある質問
          </h2>
          
          <div className="space-y-6">
            <details className="bg-white rounded-lg shadow-md">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
                本当にAIで正確な判断ができますか？
              </summary>
              <div className="px-6 pb-4 text-gray-600">
                最新のGPT-4を使用し、継続的な学習により精度は95%以上を達成しています。
                また、判定基準はカスタマイズ可能なので、貴社の基準に合わせた調整が可能です。
              </div>
            </details>
            
            <details className="bg-white rounded-lg shadow-md">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
                セキュリティは大丈夫ですか？
              </summary>
              <div className="px-6 pb-4 text-gray-600">
                すべての通信は暗号化され、データは国内のセキュアなクラウド環境で管理されています。
                ISO27001準拠の運用体制で、定期的なセキュリティ監査も実施しています。
              </div>
            </details>
            
            <details className="bg-white rounded-lg shadow-md">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
                既存のシステムとの連携はできますか？
              </summary>
              <div className="px-6 pb-4 text-gray-600">
                APIを提供しているため、既存のシステムとの連携が可能です。
                Slack、Microsoft Teams、Google Workspaceなど主要なビジネスツールとの連携実績があります。
              </div>
            </details>
            
            <details className="bg-white rounded-lg shadow-md">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
                サポート体制はどうなっていますか？
              </summary>
              <div className="px-6 pb-4 text-gray-600">
                平日9:00-18:00のメール・電話サポートに加え、チャットサポートも提供しています。
                エンタープライズプランでは専任のカスタマーサクセスマネージャーが付きます。
              </div>
            </details>
            
            <details className="bg-white rounded-lg shadow-md">
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 hover:bg-gray-50">
                解約は簡単にできますか？
              </summary>
              <div className="px-6 pb-4 text-gray-600">
                いつでもオンラインで解約可能です。解約後もデータは90日間保持され、
                必要に応じてエクスポートすることができます。
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            今なら1ヶ月間、<br />
            完全無料でお試しいただけます
          </h2>
          <p className="text-xl text-blue-100 mb-12">
            クレジットカード登録不要。いつでも解約可能。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-white text-blue-600 text-lg font-bold rounded-full hover:bg-gray-50 transition-all transform hover:scale-105 shadow-xl"
            >
              無料で今すぐ始める
            </Link>
            <button className="px-8 py-4 bg-transparent text-white text-lg font-medium rounded-full hover:bg-white/10 transition-all border-2 border-white">
              資料をダウンロード
            </button>
          </div>
          
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 text-white">
            <div>
              <div className="text-3xl font-bold mb-2">500社+</div>
              <div className="text-blue-100">導入実績</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">95%</div>
              <div className="text-blue-100">継続率</div>
            </div>
            <div>
              <div className="text-3xl font-bold mb-2">24/7</div>
              <div className="text-blue-100">稼働保証</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">AI秘書</h3>
              <p className="text-sm">
                経営者のための、<br />
                最強の情報管理パートナー
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">プロダクト</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">機能</a></li>
                <li><a href="#" className="hover:text-white">料金</a></li>
                <li><a href="#" className="hover:text-white">導入事例</a></li>
                <li><a href="#" className="hover:text-white">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">サポート</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">ヘルプセンター</a></li>
                <li><a href="#" className="hover:text-white">お問い合わせ</a></li>
                <li><a href="#" className="hover:text-white">システム状態</a></li>
                <li><a href="#" className="hover:text-white">開発者向け</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">会社情報</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">会社概要</a></li>
                <li><a href="#" className="hover:text-white">採用情報</a></li>
                <li><a href="#" className="hover:text-white">プレスリリース</a></li>
                <li><a href="#" className="hover:text-white">ブログ</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm">
            <p>© 2024 AI Secretary. All rights reserved.</p>
            <p className="mt-2">
              <a href="#" className="hover:text-white">利用規約</a> ・ 
              <a href="#" className="hover:text-white ml-2">プライバシーポリシー</a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}