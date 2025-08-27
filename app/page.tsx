import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="py-6">
          <nav className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                🤖 AI Secretary
              </h1>
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/api/webhook"
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                API Status
              </Link>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <main className="py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
              AI Secretary SaaS Platform
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
              従業員からのメッセージを AI が分析し、優先度に応じて経営者に通知する
              インテリジェントなコミュニケーションシステムです。
            </p>
            <div className="mt-10 flex items-center justify-center gap-6">
              <Link
                href="/dashboard"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
              >
                管理ダッシュボード
              </Link>
              <Link
                href="https://github.com"
                className="text-gray-600 px-8 py-3 rounded-lg text-lg font-medium hover:text-gray-900 border border-gray-300 hover:border-gray-400 transition-colors"
              >
                GitHub
              </Link>
            </div>
          </div>

          {/* Features Section */}
          <div className="mt-24">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🧠</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  AI 分析
                </h3>
                <p className="text-gray-600">
                  従業員からのメッセージを GPT-4 が自動分析し、優先度・カテゴリ・感情を判定します。
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">🚨</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  優先度別通知
                </h3>
                <p className="text-gray-600">
                  緊急度の高いメッセージは即座に LINE で経営者に通知され、迅速な対応を可能にします。
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  管理ダッシュボード
                </h3>
                <p className="text-gray-600">
                  リアルタイムの統計情報、メッセージ履歴、ユーザー管理など、包括的な管理機能を提供します。
                </p>
              </div>
            </div>
          </div>

          {/* Technical Stack */}
          <div className="mt-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">技術スタック</h2>
              <p className="mt-4 text-xl text-gray-600">
                最新の技術を使用した、スケーラブルで高性能なアーキテクチャ
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">▲</span>
                </div>
                <p className="font-medium text-gray-900">Vercel</p>
                <p className="text-sm text-gray-600">Serverless Functions</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">⚡</span>
                </div>
                <p className="font-medium text-gray-900">Upstash Redis</p>
                <p className="text-sm text-gray-600">Serverless Database</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">🤖</span>
                </div>
                <p className="font-medium text-gray-900">OpenAI GPT-4</p>
                <p className="text-sm text-gray-600">AI Analysis</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-bold">💬</span>
                </div>
                <p className="font-medium text-gray-900">LINE Bot</p>
                <p className="text-sm text-gray-600">Messaging API</p>
              </div>
            </div>
          </div>

          {/* Status Section */}
          <div className="mt-24 bg-white rounded-xl p-8 border border-gray-100">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                システム状態
              </h2>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-lg font-medium text-green-600">
                  All systems operational
                </span>
              </div>
              <p className="mt-2 text-gray-600">
                Vercel + Upstash で完全無料運用中
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="py-12 border-t border-gray-100">
          <div className="text-center text-gray-600">
            <p>© 2024 AI Secretary SaaS Platform. Built with Next.js and Vercel.</p>
            <p className="mt-2">
              🤖 Generated with{' '}
              <a href="https://claude.ai/code" className="text-blue-600 hover:text-blue-700">
                Claude Code
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
