'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Employee {
  userId: string
  name: string
  department?: string
  role: string
  registeredAt: string
}

interface Task {
  id: string
  title: string
  description?: string
  priority: string
  status: string
  dueDate?: string
  assignedTo: string
}

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  type: string
}

export default function ExecutiveDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<Record<string, unknown> | null>(null)
  const [tenantInfo, setTenantInfo] = useState<Record<string, unknown> | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [showInviteModal, setShowInviteModal] = useState(false)

  useEffect(() => {
    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const sessionId = localStorage.getItem('sessionId')
    if (!sessionId) {
      router.push('/executive/login')
      return
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          data: { sessionId }
        })
      })

      if (!response.ok) {
        router.push('/executive/login')
        return
      }

      const result = await response.json()
      if (result.user.userType !== 'executive') {
        router.push('/executive/login')
        return
      }

      setUser(result.user)
      loadDashboardData(result.user.tenantId)
    } catch {
      router.push('/executive/login')
    }
  }

  const loadDashboardData = async (tenantId: string) => {
    try {
      // テナント情報取得
      const tenantResponse = await fetch(`/api/tenant-setup?tenantId=${tenantId}`)
      if (tenantResponse.ok) {
        const data = await tenantResponse.json()
        setTenantInfo(data)
      }

      // 従業員一覧取得
      const usersResponse = await fetch('/api/tenant-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_tenant_users',
          data: { tenantId }
        })
      })

      if (usersResponse.ok) {
        const data = await usersResponse.json()
        const employeeList = data.users?.filter((u: Employee) => u.role === 'employee') || []
        setEmployees(employeeList)
      }

      // 今日のタスク取得
      const tasksResponse = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_due_tasks',
          data: { tenantId, date: new Date().toISOString() }
        })
      })

      if (tasksResponse.ok) {
        const data = await tasksResponse.json()
        setTasks(data.dueTasks || [])
      }

      // 今日のカレンダー取得
      const today = new Date().toISOString().split('T')[0]
      const eventsResponse = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_events',
          data: { 
            tenantId, 
            startDate: today,
            endDate: today,
            executiveId: user?.userId
          }
        })
      })

      if (eventsResponse.ok) {
        const data = await eventsResponse.json()
        setTodayEvents(data.events || [])
      }

      setLoading(false)
    } catch {
      console.error('Failed to load dashboard data')
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    const sessionId = localStorage.getItem('sessionId')
    if (sessionId) {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'logout',
          data: { sessionId }
        })
      })
    }
    localStorage.removeItem('sessionId')
    router.push('/executive/login')
  }

  const copyInviteCode = () => {
    const inviteCode = user?.tenantId?.slice(-8).toUpperCase()
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      alert('招待コードをコピーしました')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                経営者ダッシュボード
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {tenantInfo?.companyName || user?.tenantId}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {(user?.name as string) || ''}様
              </span>
              <button
                onClick={handleLogout}
                className="text-sm bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['overview', 'employees', 'calendar', 'tasks', 'settings'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'overview' && '概要'}
                {tab === 'employees' && '従業員管理'}
                {tab === 'calendar' && 'カレンダー'}
                {tab === 'tasks' && 'タスク管理'}
                {tab === 'settings' && '設定'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div>
            {/* サマリーカード */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">従業員数</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {employees.length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">本日の予定</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {todayEvents.length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">未完了タスク</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {tasks.filter(t => t.status !== 'completed').length}
                </p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">緊急タスク</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {tasks.filter(t => t.priority === 'urgent').length}
                </p>
              </div>
            </div>

            {/* 今日の予定 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">今日の予定</h2>
                </div>
                <div className="p-6">
                  {todayEvents.length === 0 ? (
                    <p className="text-gray-500">本日の予定はありません</p>
                  ) : (
                    <div className="space-y-3">
                      {todayEvents.map(event => (
                        <div key={event.id} className="p-3 border rounded">
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-sm text-gray-500">
                            {new Date(event.startTime).toLocaleTimeString()} -
                            {new Date(event.endTime).toLocaleTimeString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">重要タスク</h2>
                </div>
                <div className="p-6">
                  {tasks.filter(t => t.priority === 'urgent' || t.priority === 'high').length === 0 ? (
                    <p className="text-gray-500">重要なタスクはありません</p>
                  ) : (
                    <div className="space-y-3">
                      {tasks
                        .filter(t => t.priority === 'urgent' || t.priority === 'high')
                        .map(task => (
                          <div key={task.id} className="p-3 border rounded">
                            <h4 className="font-medium">{task.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">
                              {task.description}
                            </p>
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                task.priority === 'urgent' 
                                  ? 'bg-red-100 text-red-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {task.priority === 'urgent' ? '緊急' : '高'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">従業員一覧</h2>
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                従業員を招待
              </button>
            </div>
            <div className="p-6">
              {employees.length === 0 ? (
                <p className="text-gray-500">従業員が登録されていません</p>
              ) : (
                <div className="grid gap-4">
                  {employees.map(employee => (
                    <div key={employee.userId} className="p-4 border rounded hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{employee.name}</h3>
                          <p className="text-sm text-gray-500">
                            {employee.department || '部署未設定'}
                          </p>
                          <p className="text-sm text-gray-500">
                            登録日: {new Date(employee.registeredAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="text-sm text-blue-600 hover:text-blue-800">
                          詳細
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">LINE設定</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="font-medium mb-2">招待コード</h3>
                  <div className="flex items-center gap-4">
                    <code className="bg-gray-100 px-3 py-2 rounded">
                      {user?.tenantId?.slice(-8).toUpperCase()}
                    </code>
                    <button
                      onClick={copyInviteCode}
                      className="text-sm bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                    >
                      コピー
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    従業員にこのコードを共有してLINEで登録してもらってください
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Googleカレンダー連携</h2>
              </div>
              <div className="p-6">
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Googleカレンダーと連携
                </button>
                <p className="text-sm text-gray-500 mt-2">
                  カレンダーを連携すると、AI秘書が自動でスケジュール管理を行います
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 招待モーダル */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">従業員を招待</h3>
            <p className="mb-4">
              以下の招待コードを従業員に共有してください。
              従業員はLINEでこのコードを送信することで登録できます。
            </p>
            <div className="bg-gray-100 p-4 rounded mb-4">
              <p className="font-mono text-lg text-center">
                {user?.tenantId?.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                閉じる
              </button>
              <button
                onClick={() => {
                  copyInviteCode()
                  setShowInviteModal(false)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                コードをコピー
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}