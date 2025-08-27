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
  priority: 'urgent' | 'high' | 'normal' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  dueDate?: string
  assignedTo: string
  createdAt: string
  updatedAt: string
}

interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  type: string
}

interface UsageData {
  plan: {
    current: string
    details: {
      name: string
      monthlyMessageLimit: number
      employeeLimit: number
      price: number
    }
  }
  usage: {
    messages: {
      used: number
      limit: number
      remaining: number
      percentage: number
    }
    employees: {
      used: number
      limit: number
      remaining: number
    }
  }
}

interface MessageStatus {
  messageId: string
  from: string
  to: string
  toUserId: string
  content: string
  sentAt: string
  status: 'sent' | 'delivered' | 'read' | 'replied'
  readAt?: string
  replyContent?: string
  repliedAt?: string
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
  const [showEmployeeEditModal, setShowEmployeeEditModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [usageData, setUsageData] = useState<UsageData | null>(null)
  const [sentMessages, setSentMessages] = useState<MessageStatus[]>([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'normal' as Task['priority'],
    assignedTo: '',
    dueDate: ''
  })
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleSyncLoading, setGoogleSyncLoading] = useState(false)
  const [googleCalendars, setGoogleCalendars] = useState<Array<{
    id: string
    summary: string
    backgroundColor: string
    selected: boolean
    primary: boolean
  }>>([])
  const [showCalendarSelector, setShowCalendarSelector] = useState(false)

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
      loadDashboardData(result.user.tenantId, result.user.userId)
    } catch {
      router.push('/executive/login')
    }
  }

  const loadDashboardData = async (tenantId: string, userId?: string) => {
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

      // 自分のタスク一覧取得
      const tasksResponse = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_user_tasks',
          data: { 
            tenantId, 
            userId: userId 
          }
        })
      })

      if (tasksResponse.ok) {
        const data = await tasksResponse.json()
        setTasks(data.tasks || [])
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
            executiveId: userId
          }
        })
      })

      if (eventsResponse.ok) {
        const data = await eventsResponse.json()
        setTodayEvents(data.events || [])
      }
      
      // 使用量データ取得
      const usageResponse = await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_usage',
          data: { tenantId }
        })
      })
      
      if (usageResponse.ok) {
        const data = await usageResponse.json()
        setUsageData(data)
      }

      // 送信メッセージ取得
      const messagesResponse = await fetch('/api/executive-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_sent_messages',
          data: { tenantId, executiveId: userId }
        })
      })
      
      if (messagesResponse.ok) {
        const data = await messagesResponse.json()
        setSentMessages(data.messages || [])
      }

      // Googleカレンダー連携状況確認
      const googleResponse = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_connection',
          data: { tenantId, executiveId: userId }
        })
      })
      
      if (googleResponse.ok) {
        const result = await googleResponse.json()
        setGoogleConnected(result.connected)
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
    const tenantId = user?.tenantId as string | undefined
    const inviteCode = tenantId?.slice(-8).toUpperCase()
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode)
      alert('招待コードをコピーしました')
    }
  }

  const createTask = async () => {
    if (!newTask.title || !newTask.assignedTo) {
      alert('タスク名と担当者は必須です')
      return
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_task',
          data: {
            tenantId: user?.tenantId,
            assignedTo: newTask.assignedTo,
            createdBy: user?.userId,
            title: newTask.title,
            description: newTask.description,
            priority: newTask.priority,
            dueDate: newTask.dueDate
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        setTasks(prev => [result.task, ...prev])
        setShowTaskModal(false)
        setNewTask({
          title: '',
          description: '',
          priority: 'normal',
          assignedTo: '',
          dueDate: ''
        })
        alert('タスクを作成しました')
      }
    } catch (error) {
      console.error('Task creation error:', error)
      alert('タスクの作成に失敗しました')
    }
  }

  const updateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_task',
          data: {
            tenantId: user?.tenantId,
            taskId,
            updates: { status }
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        setTasks(prev => prev.map(t => t.id === taskId ? result.task : t))
      }
    } catch (error) {
      console.error('Task update error:', error)
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setNewTask({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate || ''
    })
    setShowTaskModal(true)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('このタスクを削除してもよろしいですか？')) return

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_task',
          data: {
            tenantId: user?.tenantId,
            taskId
          }
        })
      })

      if (response.ok) {
        alert('タスクを削除しました')
        loadDashboardData(user?.tenantId as string, user?.userId as string)
      } else {
        alert('タスクの削除に失敗しました')
      }
    } catch (error) {
      console.error('Task deletion error:', error)
      alert('タスクの削除中にエラーが発生しました')
    }
  }

  const handleSaveTask = async () => {
    try {
      const action = editingTask ? 'update_task' : 'create_task'
      const taskData = editingTask ? {
        ...newTask,
        taskId: editingTask.id
      } : {
        ...newTask,
        tenantId: user?.tenantId,
        createdBy: user?.userId,
        assignedTo: newTask.assignedTo || user?.userId
      }

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          data: taskData
        })
      })

      if (response.ok) {
        alert(editingTask ? 'タスクを更新しました' : 'タスクを作成しました')
        setShowTaskModal(false)
        setEditingTask(null)
        setNewTask({
          title: '',
          description: '',
          priority: 'normal',
          assignedTo: '',
          dueDate: ''
        })
        loadDashboardData(user?.tenantId as string, user?.userId as string)
      } else {
        alert('タスクの保存に失敗しました')
      }
    } catch (error) {
      console.error('Task save error:', error)
      alert('タスクの保存中にエラーが発生しました')
    }
  }

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee)
    setShowEmployeeEditModal(true)
  }

  const handleDeleteEmployee = async (userId: string) => {
    if (!confirm('この従業員を削除してもよろしいですか？関連するデータも削除されます。')) return

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_employee',
          data: {
            tenantId: user?.tenantId,
            userId
          }
        })
      })

      if (response.ok) {
        alert('従業員を削除しました')
        loadDashboardData(user?.tenantId as string, user?.userId as string)
      } else {
        alert('従業員の削除に失敗しました')
      }
    } catch (error) {
      console.error('Employee deletion error:', error)
      alert('従業員の削除中にエラーが発生しました')
    }
  }

  const handleSaveEmployee = async () => {
    if (!editingEmployee) return

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_employee',
          data: {
            tenantId: user?.tenantId,
            userId: editingEmployee.userId,
            updates: {
              name: editingEmployee.name,
              department: editingEmployee.department,
              role: editingEmployee.role
            }
          }
        })
      })

      if (response.ok) {
        alert('従業員情報を更新しました')
        setShowEmployeeEditModal(false)
        setEditingEmployee(null)
        loadDashboardData(user?.tenantId as string, user?.userId as string)
      } else {
        alert('従業員情報の更新に失敗しました')
      }
    } catch (error) {
      console.error('Employee update error:', error)
      alert('従業員情報の更新中にエラーが発生しました')
    }
  }

  const syncScheduleWithTasks = async () => {
    try {
      const response = await fetch('/api/intelligent-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'schedule_task_integration',
          data: {
            tenantId: user?.tenantId,
            executiveId: user?.userId
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`${result.message}\n\n作成されたタスク:\n${result.tasksCreated.map((t: Record<string, unknown>) => `・${t.title} (期限: ${new Date(t.dueDate as string).toLocaleDateString()})`).join('\n')}`)
        
        // タスクリストを再取得
        loadDashboardData(user?.tenantId as string, user?.userId as string)
      } else {
        alert('スケジュール連携に失敗しました')
      }
    } catch (error) {
      console.error('Schedule sync error:', error)
      alert('スケジュール連携中にエラーが発生しました')
    }
  }

  const connectGoogleCalendar = async () => {
    try {
      const response = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          data: {
            tenantId: user?.tenantId,
            executiveId: user?.userId
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        // 同じウィンドウでOAuth認証ページを開く（リダイレクトの問題を回避）
        window.location.href = result.authUrl
      }
    } catch (error) {
      console.error('Google Calendar connect error:', error)
      alert('Googleカレンダー連携に失敗しました')
    }
  }

  const loadGoogleCalendars = async () => {
    try {
      const response = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_calendars',
          data: {
            tenantId: user?.tenantId,
            executiveId: user?.userId
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        setGoogleCalendars(result.calendars.map((cal: any) => ({
          ...cal,
          selected: cal.primary // デフォルトでプライマリカレンダーを選択
        })))
        setShowCalendarSelector(true)
      }
    } catch (error) {
      console.error('Failed to load calendars:', error)
      alert('カレンダーリストの取得に失敗しました')
    }
  }

  const syncGoogleCalendar = async () => {
    setGoogleSyncLoading(true)
    try {
      // 選択されたカレンダーIDを取得
      const selectedCalendarIds = googleCalendars
        .filter(cal => cal.selected)
        .map(cal => cal.id)

      if (selectedCalendarIds.length === 0) {
        alert('同期するカレンダーを選択してください')
        setGoogleSyncLoading(false)
        return
      }

      const response = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_events',
          data: {
            tenantId: user?.tenantId,
            executiveId: user?.userId,
            calendarIds: selectedCalendarIds
          }
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(result.message)
        // カレンダー表示を更新
        loadDashboardData(user?.tenantId as string, user?.userId as string)
        setShowCalendarSelector(false)
      } else {
        alert('同期に失敗しました')
      }
    } catch (error) {
      console.error('Google Calendar sync error:', error)
      alert('同期中にエラーが発生しました')
    }
    setGoogleSyncLoading(false)
  }

  const disconnectGoogleCalendar = async () => {
    if (!confirm('Googleカレンダーとの連携を解除しますか？')) return

    try {
      const response = await fetch('/api/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'disconnect',
          data: {
            tenantId: user?.tenantId,
            executiveId: user?.userId
          }
        })
      })

      if (response.ok) {
        setGoogleConnected(false)
        alert('Googleカレンダーとの連携を解除しました')
      }
    } catch (error) {
      console.error('Google Calendar disconnect error:', error)
      alert('連携解除に失敗しました')
    }
  }

  // URL パラメータをチェックして連携成功を検知
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('connected') === 'true') {
      setGoogleConnected(true)
      alert('Googleカレンダーとの連携が完了しました！')
      // URLパラメータをクリア
      window.history.replaceState({}, '', window.location.pathname)
    } else if (urlParams.get('error')) {
      alert('Googleカレンダー連携でエラーが発生しました')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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
                {(tenantInfo?.companyName as string) || (user?.tenantId as string) || ''}
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
            {['overview', 'employees', 'calendar', 'tasks', 'usage', 'messages', 'settings'].map((tab) => (
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
                {tab === 'usage' && '使用量'}
                {tab === 'messages' && 'メッセージ'}
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
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditEmployee(employee)}
                            className="text-blue-600 hover:text-blue-800"
                            title="編集"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(employee.userId)}
                            className="text-red-600 hover:text-red-800"
                            title="削除"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            {usageData && (
              <>
                {/* 概要カード */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">今月のメッセージ</h3>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {usageData.usage.messages.used.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.418 8-9.9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.418-8 9.9-8s9.9 3.582 9.9 8z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">登録従業員数</h3>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {usageData.usage.employees.used}人
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">月額料金</h3>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          ¥{usageData.plan.details.price.toLocaleString()}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">使用量詳細: {usageData.plan.details.name}</h2>
                    <button
                      onClick={() => loadDashboardData(user?.tenantId as string, user?.userId as string)}
                      className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      🔄 更新
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-medium mb-4 flex items-center gap-2">
                          <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                          メッセージ使用量
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span>使用数</span>
                            <span className="font-medium">{usageData.usage.messages.used.toLocaleString()} / {usageData.usage.messages.limit === -1 ? '無制限' : usageData.usage.messages.limit.toLocaleString()}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-500 ${
                                usageData.usage.messages.percentage > 80 ? 'bg-red-500' :
                                usageData.usage.messages.percentage > 60 ? 'bg-yellow-500' : 'bg-blue-500'
                              }`}
                              style={{
                                width: usageData.usage.messages.limit === -1 ? '5%' : `${Math.min(100, usageData.usage.messages.percentage)}%`
                              }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>残り: {usageData.usage.messages.limit === -1 ? '無制限' : usageData.usage.messages.remaining.toLocaleString()}件</span>
                            <span>{usageData.usage.messages.limit === -1 ? '0' : Math.round(usageData.usage.messages.percentage)}%使用</span>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-4 flex items-center gap-2">
                          <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                          従業員数
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span>登録数</span>
                            <span className="font-medium">{usageData.usage.employees.used} / {usageData.usage.employees.limit === -1 ? '無制限' : usageData.usage.employees.limit}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className="bg-green-500 h-3 rounded-full transition-all duration-500"
                              style={{
                                width: usageData.usage.employees.limit === -1 ? '5%' : 
                                  `${Math.min(100, (usageData.usage.employees.used / usageData.usage.employees.limit) * 100)}%`
                              }}
                            ></div>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>残り: {usageData.usage.employees.limit === -1 ? '無制限' : usageData.usage.employees.remaining}人</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium mb-2 text-gray-800">課金情報</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>現在のプラン</span>
                            <span className="font-medium">{usageData.plan.details.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>月額料金</span>
                            <span className="font-medium">¥{usageData.plan.details.price.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium mb-2 text-blue-800">使用状況アラート</h4>
                        <div className="text-sm text-blue-700">
                          {usageData.usage.messages.limit !== -1 && usageData.usage.messages.percentage > 80 && (
                            <p className="mb-1">⚠️ メッセージ使用量が80%を超えました</p>
                          )}
                          {usageData.usage.employees.limit !== -1 && 
                           (usageData.usage.employees.used / usageData.usage.employees.limit) > 0.8 && (
                            <p className="mb-1">⚠️ 従業員数が上限に近づいています</p>
                          )}
                          {usageData.usage.messages.limit !== -1 && usageData.usage.messages.percentage <= 50 && (
                            <p className="text-green-700">✅ 使用量は正常範囲内です</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow">
                  <div className="p-6 border-b">
                    <h2 className="text-lg font-semibold">プランアップグレード</h2>
                    <p className="text-sm text-gray-600 mt-1">より多くの機能と容量が必要な場合は、プランをアップグレードしてください</p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { id: 'basic', name: 'ベーシック', price: 5000, messages: 1000, employees: 20 },
                        { id: 'premium', name: 'プレミアム', price: 20000, messages: 10000, employees: 100 },
                        { id: 'enterprise', name: 'エンタープライズ', price: 50000, messages: '無制限', employees: '無制限' }
                      ].map(plan => (
                        <div key={plan.id} className={`border rounded-lg p-4 relative ${
                          usageData.plan.current === plan.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}>
                          {usageData.plan.current === plan.id && (
                            <div className="absolute -top-2 left-4 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                              現在のプラン
                            </div>
                          )}
                          <h4 className="font-medium">{plan.name}</h4>
                          <p className="text-2xl font-bold text-gray-900 mt-2">¥{plan.price.toLocaleString()}</p>
                          <ul className="text-sm text-gray-600 mt-3 space-y-1">
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                              メッセージ: {plan.messages}件/月
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                              従業員: {plan.employees}人
                            </li>
                          </ul>
                          <button 
                            className="w-full mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={usageData.plan.current === plan.id}
                          >
                            {usageData.plan.current === plan.id ? '利用中' : 'アップグレード'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
            
            {!usageData && (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-400 text-4xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-600 mb-2">使用量データを読み込み中...</h3>
                <p className="text-sm text-gray-500">しばらくお待ちください</p>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'messages' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">送信メッセージ状態</h2>
            </div>
            <div className="p-6">
              {sentMessages.length === 0 ? (
                <p className="text-gray-500">送信したメッセージはありません</p>
              ) : (
                <div className="space-y-4">
                  {sentMessages.map(msg => (
                    <div key={msg.messageId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">宛先: {msg.to}</h4>
                        <span className={`text-xs px-2 py-1 rounded ${
                          msg.status === 'sent' ? 'bg-gray-100 text-gray-800' :
                          msg.status === 'read' ? 'bg-blue-100 text-blue-800' :
                          msg.status === 'replied' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {msg.status === 'sent' && '送信済み'}
                          {msg.status === 'read' && '既読'}
                          {msg.status === 'replied' && '返信あり'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{msg.content}</p>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>送信: {new Date(msg.sentAt).toLocaleString()}</span>
                        {msg.readAt && <span>既読: {new Date(msg.readAt).toLocaleString()}</span>}
                      </div>
                      {msg.replyContent && (
                        <div className="mt-2 p-2 bg-gray-50 rounded">
                          <p className="text-sm font-medium">返信内容:</p>
                          <p className="text-sm">{msg.replyContent}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {/* カレンダー連携状況 */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">カレンダー管理</h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${googleConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-600">
                      {googleConnected ? 'Googleカレンダー連携中' : 'Googleカレンダー未連携'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {googleConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h3 className="font-medium text-green-800">Googleカレンダーと連携済み</h3>
                        <p className="text-sm text-green-700">カレンダーイベントが自動的に同期されます</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={loadGoogleCalendars}
                        disabled={googleSyncLoading}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {googleSyncLoading ? '同期中...' : '📅 カレンダーを選択して同期'}
                      </button>
                      <button
                        onClick={disconnectGoogleCalendar}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                      >
                        連携解除
                      </button>
                    </div>
                    
                    {/* カレンダー選択モーダル */}
                    {showCalendarSelector && (
                      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                          <h3 className="text-lg font-semibold mb-4">同期するカレンダーを選択</h3>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {googleCalendars.map((calendar) => (
                              <label key={calendar.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={calendar.selected}
                                  onChange={(e) => {
                                    setGoogleCalendars(prev =>
                                      prev.map(cal =>
                                        cal.id === calendar.id
                                          ? { ...cal, selected: e.target.checked }
                                          : cal
                                      )
                                    )
                                  }}
                                  className="mr-3"
                                />
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: calendar.backgroundColor }}
                                  />
                                  <span className="font-medium">{calendar.summary}</span>
                                  {calendar.primary && (
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                      メイン
                                    </span>
                                  )}
                                </div>
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end gap-3 mt-6">
                            <button
                              onClick={() => setShowCalendarSelector(false)}
                              className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                              キャンセル
                            </button>
                            <button
                              onClick={syncGoogleCalendar}
                              disabled={googleSyncLoading || googleCalendars.filter(c => c.selected).length === 0}
                              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                            >
                              選択したカレンダーを同期
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Googleカレンダー連携</h3>
                    <p className="text-gray-600 mb-6">
                      カレンダーを連携すると、AI秘書が自動でスケジュール管理を行います
                      <br />・予定の自動取り込み<br />・会議前の準備タスク自動作成<br />・スケジュール変更の通知
                    </p>
                    <button
                      onClick={connectGoogleCalendar}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                    >
                      📅 Googleカレンダーと連携する
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 今日の予定表示 */}
            {googleConnected && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">今日の予定</h2>
                </div>
                <div className="p-6">
                  {todayEvents.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500">本日の予定はありません</p>
                      <button
                        onClick={syncGoogleCalendar}
                        disabled={googleSyncLoading}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        カレンダーを同期して最新情報を取得
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todayEvents.map(event => (
                        <div key={event.id} className="p-4 border rounded-lg hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{event.title}</h4>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                <span>🕒 {new Date(event.startTime).toLocaleTimeString()} - {new Date(event.endTime).toLocaleTimeString()}</span>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  event.type === 'meeting' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {event.type === 'meeting' ? '会議' : 'イベント'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">タスク管理</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={syncScheduleWithTasks}
                      className="bg-green-600 text-white px-4 py-2 text-sm rounded hover:bg-green-700"
                    >
                      📅 スケジュール連携
                    </button>
                    <button
                      onClick={() => setShowTaskModal(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      新規タスク
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  スケジュール連携ボタンで、カレンダーの予定から自動的にタスクを作成できます
                </p>
              </div>
              <div className="p-6">
                {tasks.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-gray-500">タスクがありません</p>
                    <p className="text-sm text-gray-400 mt-2">AI秘書に「〜のタスクを作って」と依頼してみてください</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* タスクのステータス別セクション */}
                    <div className="mb-6">
                      <h3 className="font-medium text-gray-700 mb-3">進行中のタスク</h3>
                      {tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').map(task => (
                        <div key={task.id} className="p-4 border rounded-lg mb-2 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{task.title}</h4>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  task.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                                  task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  task.priority === 'normal' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {task.priority === 'urgent' && '緊急'}
                                  {task.priority === 'high' && '高'}
                                  {task.priority === 'normal' && '通常'}
                                  {task.priority === 'low' && '低'}
                                </span>
                                {task.dueDate && (
                                  <span className="text-xs text-gray-500">
                                    期限: {new Date(task.dueDate).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditTask(task)}
                                className="text-blue-600 hover:text-blue-800"
                                title="編集"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => updateTaskStatus(task.id, 'completed')}
                                className="text-green-600 hover:text-green-800"
                                title="完了にする"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteTask(task.id)}
                                className="text-red-600 hover:text-red-800"
                                title="削除"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 完了済みタスク */}
                    {tasks.filter(t => t.status === 'completed').length > 0 && (
                      <div>
                        <h3 className="font-medium text-gray-700 mb-3">完了済みタスク</h3>
                        {tasks.filter(t => t.status === 'completed').map(task => (
                          <div key={task.id} className="p-4 border rounded-lg mb-2 opacity-60">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <h4 className="font-medium text-gray-700 line-through">{task.title}</h4>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
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
                      {(user?.tenantId as string)?.slice(-8).toUpperCase()}
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
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Googleカレンダー連携</h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${googleConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className="text-sm text-gray-600">
                      {googleConnected ? '連携中' : '未連携'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {googleConnected ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-green-800">連携が完了しています</span>
                      </div>
                      <p className="text-sm text-green-700">
                        Googleカレンダーのイベントが自動的に同期され、会議の準備タスクが作成されます
                      </p>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={syncGoogleCalendar}
                        disabled={googleSyncLoading}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {googleSyncLoading ? '同期中...' : '手動同期'}
                      </button>
                      <button
                        onClick={disconnectGoogleCalendar}
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                      >
                        連携解除
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      onClick={connectGoogleCalendar}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Googleカレンダーと連携
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      カレンダーを連携すると、AI秘書が自動でスケジュール管理を行います
                    </p>
                    <ul className="text-sm text-gray-500 mt-2 ml-4 list-disc">
                      <li>予定の自動取り込み</li>
                      <li>会議前の準備タスク自動作成</li>
                      <li>スケジュール変更の通知</li>
                    </ul>
                  </div>
                )}
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
                {((user?.tenantId as string) || '')?.slice(-8).toUpperCase()}
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

      {/* タスク作成モーダル */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">{editingTask ? 'タスク編集' : '新規タスク作成'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タスク名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例：営業資料の作成"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  詳細説明
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="タスクの詳細を入力"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当者 <span className="text-red-500">*</span>
                </label>
                <select
                  value={newTask.assignedTo}
                  onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {employees.map((emp) => (
                    <option key={emp.userId} value={emp.userId}>
                      {emp.name} ({emp.department || '未設定'})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  優先度
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">低</option>
                  <option value="normal">通常</option>
                  <option value="high">高</option>
                  <option value="urgent">緊急</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  期限
                </label>
                <input
                  type="datetime-local"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowTaskModal(false)
                  setEditingTask(null)
                  setNewTask({
                    title: '',
                    description: '',
                    priority: 'normal',
                    assignedTo: '',
                    dueDate: ''
                  })
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveTask}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {editingTask ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 従業員編集モーダル */}
      {showEmployeeEditModal && editingEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">従業員情報編集</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  名前 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingEmployee.name}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  部署
                </label>
                <input
                  type="text"
                  value={editingEmployee.department || ''}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例：営業部"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  役職
                </label>
                <select
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="employee">従業員</option>
                  <option value="manager">マネージャー</option>
                  <option value="executive">役員</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowEmployeeEditModal(false)
                  setEditingEmployee(null)
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveEmployee}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                更新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}