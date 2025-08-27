'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Tenant {
  tenantId: string
  companyName: string
  createdAt: string
  plan: string
  isActive: boolean
}

interface User {
  userId: string
  name: string
  email?: string
  role: string
  tenantId?: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<Record<string, unknown> | null>(null)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null)
  const [tenantUsers, setTenantUsers] = useState<User[]>([])
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalUsers: 0,
    activeUsers: 0
  })

  useEffect(() => {
    checkAuth()
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuth = async () => {
    const sessionId = localStorage.getItem('sessionId')
    if (!sessionId) {
      router.push('/admin/login')
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
        router.push('/admin/login')
        return
      }

      const result = await response.json()
      if (result.user.userType !== 'admin') {
        router.push('/admin/login')
        return
      }

      setUser(result.user)
    } catch {
      router.push('/admin/login')
    }
  }

  const loadData = async () => {
    try {
      // テナント一覧取得
      const tenantsResponse = await fetch('/api/admin/tenants')
      if (tenantsResponse.ok) {
        const data = await tenantsResponse.json()
        setTenants(data.tenants || [])
        setStats(prev => ({ ...prev, totalTenants: data.tenants?.length || 0 }))
      }

      setLoading(false)
    } catch {
      console.error('Failed to load data')
      setLoading(false)
    }
  }

  const loadTenantUsers = async (tenantId: string) => {
    try {
      const response = await fetch('/api/tenant-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_tenant_users',
          data: { tenantId }
        })
      })

      if (response.ok) {
        const data = await response.json()
        setTenantUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to load tenant users:', error)
    }
  }

  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenant(tenantId)
    loadTenantUsers(tenantId)
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
    router.push('/admin/login')
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
            <h1 className="text-2xl font-bold text-gray-900">
              システム管理者ダッシュボード
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user?.name || 'Admin'}
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

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">総テナント数</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {stats.totalTenants}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">総ユーザー数</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {stats.totalUsers}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">アクティブユーザー</h3>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {stats.activeUsers}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* テナント一覧 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">テナント一覧</h2>
            </div>
            <div className="p-6">
              {tenants.length === 0 ? (
                <p className="text-gray-500">テナントがありません</p>
              ) : (
                <div className="space-y-3">
                  {tenants.map(tenant => (
                    <div
                      key={tenant.tenantId}
                      onClick={() => handleTenantSelect(tenant.tenantId)}
                      className={`p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                        selectedTenant === tenant.tenantId ? 'bg-blue-50 border-blue-500' : ''
                      }`}
                    >
                      <h3 className="font-medium">{tenant.companyName}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        ID: {tenant.tenantId}
                      </p>
                      <p className="text-sm text-gray-500">
                        作成日: {new Date(tenant.createdAt).toLocaleDateString()}
                      </p>
                      <div className="mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          tenant.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {tenant.isActive ? 'アクティブ' : '非アクティブ'}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 ml-2">
                          {tenant.plan}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 選択されたテナントの詳細 */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold">
                {selectedTenant ? 'テナント詳細' : 'テナントを選択してください'}
              </h2>
            </div>
            <div className="p-6">
              {selectedTenant && tenantUsers.length > 0 ? (
                <div>
                  <h3 className="font-medium mb-3">登録ユーザー</h3>
                  <div className="space-y-2">
                    {tenantUsers.map(user => (
                      <div key={user.userId} className="p-3 border rounded">
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-gray-500">
                          役割: {user.role === 'executive' ? '経営者' : '従業員'}
                        </p>
                        <p className="text-sm text-gray-500">ID: {user.userId}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedTenant ? (
                <p className="text-gray-500">ユーザーが登録されていません</p>
              ) : (
                <p className="text-gray-500">左側からテナントを選択してください</p>
              )}
            </div>
          </div>
        </div>

        {/* システム設定 */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">システム設定</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <button className="w-full text-left p-4 border rounded hover:bg-gray-50">
                <h3 className="font-medium">環境変数管理</h3>
                <p className="text-sm text-gray-500 mt-1">
                  API キーやシークレットの管理
                </p>
              </button>
              <button className="w-full text-left p-4 border rounded hover:bg-gray-50">
                <h3 className="font-medium">バックアップ設定</h3>
                <p className="text-sm text-gray-500 mt-1">
                  データバックアップの設定と実行
                </p>
              </button>
              <button className="w-full text-left p-4 border rounded hover:bg-gray-50">
                <h3 className="font-medium">ログ監視</h3>
                <p className="text-sm text-gray-500 mt-1">
                  システムログの確認とエラー監視
                </p>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}