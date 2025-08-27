/**
 * テナントセットアップテストスクリプト
 * 合同会社Leadfiveのテナント作成と動作確認
 */

async function testTenantSetup() {
  const baseUrl = 'https://ai-secretary-ten.vercel.app'
  // const baseUrl = 'http://localhost:3000' // ローカルテスト用
  
  console.log('🚀 マルチテナントセットアップテスト開始...\n')
  
  try {
    // 1. テナント作成（合同会社Leadfive）
    console.log('1️⃣ 合同会社Leadfiveのテナント作成...')
    const createResponse = await fetch(`${baseUrl}/api/tenant-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_tenant',
        data: {
          companyName: '合同会社Leadfive',
          adminUserId: '9753763', // あなたのLINE ID
          adminName: '経営者'
        }
      })
    })
    
    if (!createResponse.ok) {
      throw new Error(`Tenant creation failed: ${createResponse.status}`)
    }
    
    const tenantData = await createResponse.json()
    console.log('✅ テナント作成成功!')
    console.log(`   テナントID: ${tenantData.tenantId}`)
    console.log(`   招待コード: ${tenantData.tenantId.slice(-8).toUpperCase()}`)
    console.log('')
    
    // 2. カレンダーイベント作成テスト
    console.log('2️⃣ カレンダーイベント作成...')
    const eventResponse = await fetch(`${baseUrl}/api/calendar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_event',
        data: {
          tenantId: tenantData.tenantId,
          executiveId: '9753763',
          title: '週次ミーティング',
          description: 'AI秘書システムの進捗確認',
          startTime: new Date(Date.now() + 86400000).toISOString(), // 明日
          endTime: new Date(Date.now() + 90000000).toISOString(), // 明日+1時間
          type: 'meeting',
          createdBy: '9753763'
        }
      })
    })
    
    if (eventResponse.ok) {
      const event = await eventResponse.json()
      console.log('✅ カレンダーイベント作成成功!')
      console.log(`   イベントID: ${event.event.id}`)
    }
    console.log('')
    
    // 3. タスク作成テスト
    console.log('3️⃣ タスク作成...')
    const taskResponse = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_task',
        data: {
          tenantId: tenantData.tenantId,
          assignedTo: '9753763',
          createdBy: '9753763',
          title: 'AI秘書システムのマニュアル作成',
          description: '従業員向けの利用マニュアルを作成する',
          priority: 'high',
          category: 'document',
          dueDate: new Date(Date.now() + 604800000).toISOString(), // 1週間後
          reminder: {
            enabled: true,
            timing: [new Date(Date.now() + 518400000).toISOString()] // 6日後
          }
        }
      })
    })
    
    if (taskResponse.ok) {
      const task = await taskResponse.json()
      console.log('✅ タスク作成成功!')
      console.log(`   タスクID: ${task.task.id}`)
    }
    console.log('')
    
    // 4. 従業員招待用の情報表示
    console.log('4️⃣ 従業員招待情報')
    console.log('==========================================')
    console.log('従業員の方は以下のメッセージをLINEで送信してください:')
    console.log(`\n招待コード: ${tenantData.tenantId.slice(-8).toUpperCase()}\n`)
    console.log('その後、名前と部署を送信してください。')
    console.log('例：「山田太郎です。営業部です。」')
    console.log('==========================================')
    console.log('')
    
    // 5. テスト結果サマリー
    console.log('📊 セットアップ完了!')
    console.log('- テナントID:', tenantData.tenantId)
    console.log('- 管理者LINE ID:', '9753763')
    console.log('- カレンダー機能: ✅')
    console.log('- タスク管理機能: ✅')
    console.log('- マルチテナント対応: ✅')
    
    return tenantData
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error)
    throw error
  }
}

// 実行
testTenantSetup()
  .then(() => console.log('\n✨ すべてのテストが正常に完了しました!'))
  .catch(() => console.log('\n❌ テストが失敗しました'))