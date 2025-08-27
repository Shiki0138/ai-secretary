'use client'

import { useState, useEffect } from 'react'

interface DashboardStats {
  monthly_stats: {
    total_messages: number
    urgent_messages: number
    active_tenants: number
    ai_processing_hours: number
  }
  plan_usage: {
    database_size: string
    api_calls: string
    users: string
  }
}

interface Message {
  id: string
  userId: string
  message: string
  timestamp: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  category: 'report' | 'consultation' | 'proposal' | 'issue'
  summary: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentMessages, setRecentMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // ダッシュボード統計取得
      const statsResponse = await fetch('/api/dashboard')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }
      
      // 最近のメッセージ取得
      const messagesResponse = await fetch('/api/messages')
      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json()
        setRecentMessages(messagesData.messages || [])
      }
      
    } catch (error) {
      console.error('Dashboard data loading failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'normal': return 'text-blue-600 bg-blue-50'
      case 'low': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              🤖 AI Secretary Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={loadDashboardData}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">📊</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Messages
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.monthly_stats.total_messages || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">🚨</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Urgent Messages
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.monthly_stats.urgent_messages || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">🏢</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Active Tenants
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.monthly_stats.active_tenants || 1}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm">⏱️</span>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      AI Processing Hours
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats?.monthly_stats.ai_processing_hours || 0}h
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Metrics */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Plan Usage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <dt className="text-sm font-medium text-gray-500">Database</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {stats?.plan_usage.database_size || "Loading..."}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">API Calls</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {stats?.plan_usage.api_calls || "Loading..."}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Users</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {stats?.plan_usage.users || "Loading..."}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Messages */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Recent Messages
            </h3>
            {recentMessages.length > 0 ? (
              <div className="space-y-4">
                {recentMessages.map((message) => (
                  <div
                    key={message.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(
                          message.priority
                        )}`}
                      >
                        {message.priority}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(message.timestamp).toLocaleString('ja-JP')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 mb-2">
                      <strong>Summary:</strong> {message.summary}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      Original: {message.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No recent messages found.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}