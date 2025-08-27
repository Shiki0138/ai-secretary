/**
 * LINE Bot Webhook API - マルチテナント対応版
 * 企業ごとに完全にデータを分離
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import OpenAI from 'openai'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// 型定義
interface UserInfo {
  userId: string
  name: string
  tenantId: string
  role: 'executive' | 'employee'
  department?: string
  registeredAt: string
}

interface MessageAnalysis {
  priority: 'urgent' | 'high' | 'normal' | 'low'
  category: 'report' | 'consultation' | 'proposal' | 'issue'
  summary: string
  requiredAction: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

// ユーザー情報取得（テナント情報付き）
async function getUserWithTenant(userId: string): Promise<{ userInfo: UserInfo | null; tenantId: string | null }> {
  try {
    // グローバルユーザー情報からテナントID取得
    const globalUser = await redis.get(`user:${userId}`) as { tenantId: string; role: string } | null
    
    if (!globalUser || !globalUser.tenantId) {
      return { userInfo: null, tenantId: null }
    }
    
    // テナント固有のユーザー情報取得
    const userInfo = await redis.get(`tenant:${globalUser.tenantId}:user:${userId}`) as UserInfo | null
    
    return { userInfo, tenantId: globalUser.tenantId }
    
  } catch (error) {
    console.error('User fetch error:', error)
    return { userInfo: null, tenantId: null }
  }
}

// 使用量チェック関数
async function checkUsageLimit(tenantId: string): Promise<{
  allowed: boolean
  usage: number
  limit: number
  remaining: number
}> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_usage',
        data: { tenantId }
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      const usage = result.usage.messages
      return {
        allowed: usage.remaining > 0 || usage.limit === -1,
        usage: usage.used,
        limit: usage.limit,
        remaining: usage.remaining
      }
    }
  } catch {
    // エラー時は使用を許可（緊急時のフェイルセーフ）
  }
  
  return { allowed: true, usage: 0, limit: -1, remaining: -1 }
}

// 使用量記録関数
async function recordUsage(tenantId: string, type: 'message' | 'api_call') {
  const monthKey = new Date().toISOString().slice(0, 7)
  const usageKey = `tenant:${tenantId}:usage:${monthKey}:${type}`
  await redis.incr(usageKey)
  await redis.expire(usageKey, 86400 * 60)
}

// 従業員への指示かチェック
async function isEmployeeCommand(message: string): Promise<boolean> {
  const patterns = [
    /(.+?)(?:さん|くん|ちゃん)?に(.+?)(?:と)?(?:伝えて|言って|連絡して|知らせて)/,
    /(.+?)に対して(.+?)(?:を)?(?:伝えて|言って|連絡して|知らせて)/,
    /(.+?)へ(.+?)(?:を)?(?:送って|送信して)/,
    /(.+?)に(.+?)(?:を)?(?:お願い|頼んで|やってもらって|してもらって)/,
    /^(.{2,4})に(.+)$/  // 「田中に〜」のような短い指示にも対応
  ]
  
  return patterns.some(pattern => {
    const match = message.match(pattern)
    if (match) {
      const targetName = match[1].trim()
      // 従業員名っぽいかチェック
      return targetName.length >= 2 && targetName.length <= 4 && 
        !targetName.match(/(今日|明日|来週|至急|すぐ|早く|ちょっと)/)
    }
    return false
  })
}

// 従業員への指示処理
async function handleEmployeeCommand(
  event: Record<string, unknown>,
  tenantId: string,
  executiveId: string,
  message: string
) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/executive-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_to_employee',
        data: {
          tenantId,
          executiveId,
          message
        }
      })
    })
    
    const result = await response.json()
    const replyToken = event['replyToken'] as string
    
    if (response.ok) {
      await sendLineReply(replyToken, result.message)
    } else {
      await sendLineReply(replyToken, result.error || '指示の処理に失敗しました。')
    }
    
  } catch (error) {
    console.error('Employee command error:', error)
    const replyToken = event['replyToken'] as string
    await sendLineReply(replyToken, '指示の処理中にエラーが発生しました。')
  }
}

// 経営者の思考を推測する関数
async function getExecutiveThinking(tenantId: string, employeeQuestion: string): Promise<string> {
  try {
    // テナントの経営者IDを取得
    const executives = await redis.smembers(`tenant:${tenantId}:executives`) || []
    if (executives.length === 0) return ''
    
    const executiveId = executives[0] // 最初の経営者
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/executive-command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'predict_response',
        data: {
          tenantId,
          executiveId,
          question: employeeQuestion
        }
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      if (result.confidence > 50) {
        return `\n\ud83e\uddd0 **経営者の思考パターンからの推測**\n「${result.prediction}」\n\n${result.disclaimer || ''}`
      }
    }
  } catch (error) {
    console.error('Executive thinking error:', error)
  }
  
  return ''
}

// AI分析（テナントコンテキスト付き）
async function analyzeMessage(message: string, userInfo: UserInfo | null, tenantInfo: Record<string, unknown> | null): Promise<MessageAnalysis> {
  try {
    const prompt = `あなたは${tenantInfo?.companyName || '企業'}の秘書として、従業員からのメッセージを分析します。

従業員情報:
- 名前: ${userInfo?.name || '不明'}
- 部署: ${userInfo?.department || '不明'}

メッセージ: ${message}

以下のJSON形式で分析してください:
{
  "priority": "urgent/high/normal/low",
  "category": "report/consultation/proposal/issue",
  "summary": "経営者向け要約（30字以内）",
  "requiredAction": "必要なアクション",
  "sentiment": "positive/neutral/negative"
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは企業の有能な秘書です。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch {
    return {
      priority: 'normal',
      category: 'report',
      summary: message.substring(0, 30),
      requiredAction: '',
      sentiment: 'neutral'
    }
  }
}

// 経営者メッセージ処理（テナント対応）
async function handleExecutiveMessage(
  event: Record<string, unknown>,
  userId: string,
  message: string,
  userInfo: UserInfo,
  tenantId: string
) {
  // 使用量チェック
  const usageCheck = await checkUsageLimit(tenantId)
  if (!usageCheck.allowed) {
    const replyToken = event['replyToken'] as string
    await sendLineReply(replyToken, 
      `申し訳ございませんが、今月の使用制限に達しました。\n` +
      `現在の使用量: ${usageCheck.usage}/${usageCheck.limit}\n` + 
      `プランのアップグレードをご検討ください。`
    )
    return
  }

  // メッセージをテナント固有のキューに保存
  const messageData = {
    id: Date.now().toString(),
    userId,
    message,
    timestamp: new Date().toISOString(),
    userRole: 'executive'
  }
  
  await redis.lpush(`tenant:${tenantId}:executive_messages`, JSON.stringify(messageData))
  
  // 使用量を記録
  await recordUsage(tenantId, 'message')
  
  // 承認・却下の返答をチェック
  if (message.match(/(はい|yes|実行|承認|ok)/i)) {
    await handleActionConfirmation(event, tenantId, userId, true)
    return
  } else if (message.match(/(いいえ|no|キャンセル|却下|やめて)/i)) {
    await handleActionConfirmation(event, tenantId, userId, false)
    return
  }
  
  // 高度な意図分析を実行
  try {
    const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/intelligent-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze_executive_message',
        data: {
          tenantId,
          executiveId: userId,
          message
        }
      })
    })
    
    if (analysisResponse.ok) {
      const analysis = await analysisResponse.json()
      const replyToken = event['replyToken'] as string
      
      if (analysis.needsConfirmation) {
        // 承認待ちのアクションIDを保存
        await redis.set(
          `temp:${userId}:pending_action`,
          analysis.actionId,
          { ex: 3600 } // 1時間で期限切れ
        )
        
        await sendLineReply(replyToken, analysis.confirmationMessage)
        return
      } else {
        await sendLineReply(replyToken, analysis.response)
        return
      }
    }
  } catch (error) {
    console.error('Advanced analysis failed:', error)
  }
  
  // フォールバック: 従来の処理
  if (await isEmployeeCommand(message)) {
    await handleEmployeeCommand(event, tenantId, userId, message)
    return
  }
  
  // 返信生成
  const replyMessage = await generateExecutiveReply(message, userInfo)
  const replyToken = event['replyToken'] as string
  await sendLineReply(replyToken, replyMessage)
}

// 従業員メッセージ処理（テナント対応）
async function handleEmployeeMessage(
  event: Record<string, unknown>,
  userId: string,
  message: string,
  userInfo: UserInfo,
  tenantId: string
) {
  // 使用量チェック
  const usageCheck = await checkUsageLimit(tenantId)
  if (!usageCheck.allowed) {
    const replyToken = event['replyToken'] as string
    await sendLineReply(replyToken, '申し訳ございませんが、今月の使用制限に達しています。')
    return
  }

  // テナント情報取得
  const tenantInfo = await redis.get(`tenant:${tenantId}:info`) as Record<string, unknown> | null
  
  // メッセージをテナント固有のキューに保存
  const messageData = {
    id: Date.now().toString(),
    userId,
    userInfo,
    message,
    timestamp: new Date().toISOString()
  }
  
  await redis.lpush(`tenant:${tenantId}:employee_messages`, JSON.stringify(messageData))
  
  // 使用量を記録
  await recordUsage(tenantId, 'message')
  
  // 高度な報告処理を実行
  let replyMessage = ''
  try {
    const reportResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/intelligent-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process_employee_report',
        data: {
          tenantId,
          employeeInfo: userInfo,
          report: message
        }
      })
    })
    
    if (reportResponse.ok) {
      const result = await reportResponse.json()
      
      // 経営者への詳細通知を送信
      if (result.summary.needsExecutiveDecision || 
          result.summary.actionItems.length > 0) {
        await notifyTenantExecutivesAdvanced(tenantId, userInfo, result.executiveNotification)
      }
      
      replyMessage = result.employeeResponse
    }
  } catch (error) {
    console.error('Advanced report processing failed:', error)
  }
  
  // フォールバック: 従来の処理
  if (!replyMessage) {
    // AI分析
    const analysis = await analyzeMessage(message, userInfo, tenantInfo)
    
    // 分析結果をテナント固有のキーで保存
    await redis.set(`tenant:${tenantId}:analysis:${messageData.id}`, JSON.stringify(analysis), { ex: 86400 * 7 })
    
    // 同じテナントの経営者に通知
    if (analysis.priority === 'urgent' || analysis.priority === 'high') {
      await notifyTenantExecutives(tenantId, userInfo, message, analysis)
    }
    
    // プロアクティブAI秘書機能：経営者の思考を推測
    let proactiveAdvice = ''
    if (analysis.category === 'consultation' || analysis.category === 'proposal') {
      proactiveAdvice = await getExecutiveThinking(tenantId, message)
    }
    
    // 返信生成
    replyMessage = await generateEmployeeReply(message, analysis, userInfo)
    
    // プロアクティブアドバイスを追加
    if (proactiveAdvice && proactiveAdvice.length > 0) {
      replyMessage += '\n\n' + proactiveAdvice
    }
  }
  
  const replyToken = event['replyToken'] as string
  await sendLineReply(replyToken, replyMessage)
}

// 承認・却下の確認処理
async function handleActionConfirmation(
  event: Record<string, unknown>,
  tenantId: string,
  userId: string,
  approved: boolean
) {
  try {
    const actionId = await redis.get(`temp:${userId}:pending_action`) as string
    
    if (!actionId) {
      const replyToken = event['replyToken'] as string
      await sendLineReply(replyToken, '確認待ちのアクションが見つかりません。')
      return
    }
    
    const confirmResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/intelligent-assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm_action',
        data: {
          tenantId,
          actionId,
          approved
        }
      })
    })
    
    if (confirmResponse.ok) {
      const result = await confirmResponse.json()
      const replyToken = event['replyToken'] as string
      await sendLineReply(replyToken, result.message)
      
      // 一時保存したアクションIDを削除
      await redis.del(`temp:${userId}:pending_action`)
    }
  } catch (error) {
    console.error('Action confirmation error:', error)
    const replyToken = event['replyToken'] as string
    await sendLineReply(replyToken, 'アクションの確認処理中にエラーが発生しました。')
  }
}

// 高度な経営者通知
async function notifyTenantExecutivesAdvanced(
  tenantId: string,
  employeeInfo: UserInfo,
  notificationMessage: string
) {
  // 同じテナントの経営者のみ取得
  const executiveIds = await redis.smembers(`tenant:${tenantId}:executives`) || []
  
  // 各経営者に通知
  for (const execId of executiveIds) {
    await sendLineNotification(execId, notificationMessage)
  }
}

// テナント内の経営者への通知
async function notifyTenantExecutives(
  tenantId: string,
  employeeInfo: UserInfo,
  message: string,
  analysis: MessageAnalysis
) {
  // 同じテナントの経営者のみ取得
  const executiveIds = await redis.smembers(`tenant:${tenantId}:executives`) || []
  
  const notification = `📋 ${analysis.priority === 'urgent' ? '緊急' : '重要'}報告

報告者: ${employeeInfo.name}（${employeeInfo.department || '部署不明'}）

【要約】
${analysis.summary}

【詳細】
${message}

${analysis.requiredAction ? `【推奨アクション】\n${analysis.requiredAction}` : ''}`

  // 各経営者に通知
  for (const execId of executiveIds) {
    await sendLineNotification(execId, notification)
  }
}

// 未登録ユーザー処理（テナント招待コード対応）
async function handleUnknownUser(event: Record<string, unknown>, userId: string, message: string) {
  // 招待コードチェック
  const inviteMatch = message.match(/招待コード[:：]?\s*([A-Z0-9]{6,})/i)
  
  if (inviteMatch) {
    const inviteCode = inviteMatch[1]
    const inviteInfo = await redis.get(`invite:${inviteCode}`)
    
    if (inviteInfo && typeof inviteInfo === 'object') {
      const { tenantId, role } = inviteInfo as { tenantId: string; role: string }
      
      const replyToken = event['replyToken'] as string
      await sendLineReply(
        replyToken,
        `招待コードが確認できました。
        
続けて以下の情報をお送りください：
1. お名前
2. 部署（任意）

例：「山田太郎です。営業部です。」`
      )
      
      // 招待プロセスを記録
      await redis.set(`registration:${userId}`, JSON.stringify({
        tenantId,
        role,
        inviteCode,
        timestamp: new Date().toISOString()
      }), { ex: 3600 })
      
      return
    }
  }
  
  // 自動登録パターンチェック（新規テナント作成）
  const patterns = [
    /(.+)です。.*合同会社\s*([^\s]+).*の.*経営者/,
    /(.+)です。.*会社\s*([^\s]+).*の.*経営者/,
    /(.+)です。.*([^\s]+).*の.*経営者/,
    /(.+)です。.*([^\s]+).*CEO/,
    /(.+)です。.*([^\s]+).*社長/
  ]
  
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      const name = match[1].trim()
      const companyName = match[2] ? match[2].trim() : '未設定'
      
      // 新規テナント作成
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-secretary-ten.vercel.app'}/api/tenant-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tenant',
          data: {
            companyName,
            adminUserId: userId,
            adminName: name
          }
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        
        const replyToken = event['replyToken'] as string
        await sendLineReply(
          replyToken,
          `${name}様、はじめまして。

AI秘書システムへようこそ。
${companyName}の経営者として登録完了しました。

テナントID: ${result.tenantId}

従業員を招待する場合は、以下の招待コードをお伝えください：
招待コード: ${result.tenantId.slice(-8).toUpperCase()}

どのようなご用件でしょうか？`
        )
        return
      }
    }
  }
  
  // 通常の登録案内
  const replyToken = event['replyToken'] as string
  await sendLineReply(
    replyToken,
    `はじめまして。AI秘書システムです。

【新規登録の場合】
以下の形式でお送りください：
「山田太郎です。ABC商事の経営者をしています。」

【既存企業に参加の場合】
招待コードをお持ちの方は：
「招待コード: XXXXXX」

どちらかの方法でご登録ください。`
  )
}

// 返信生成関数
async function generateExecutiveReply(message: string, userInfo: UserInfo): Promise<string> {
  const prompt = `あなたは${userInfo.name}様の有能な秘書です。以下の指示に適切に応答してください。

指示: ${message}

簡潔で的確な返信を作成してください。`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "あなたは有能な秘書です。" },
        { role: "user", content: prompt }
      ],
      max_tokens: 200
    })
    
    return response.choices[0].message.content || '承知いたしました。'
  } catch {
    return '承知いたしました。対応いたします。'
  }
}

async function generateEmployeeReply(
  message: string,
  analysis: MessageAnalysis,
  userInfo: UserInfo
): Promise<string> {
  let reply = `${userInfo.name}様、ご報告ありがとうございます。

「${analysis.summary}」について承りました。`

  if (analysis.priority === 'urgent') {
    reply += '\n\n🚨 緊急案件として経営者に即座に通知いたしました。'
  } else if (analysis.priority === 'high') {
    reply += '\n\n📌 重要案件として優先的に処理いたします。'
  } else {
    reply += '\n\n適切なタイミングで経営者に報告いたします。'
  }
  
  return reply
}

// LINE通知送信
async function sendLineNotification(userId: string, message: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: message }]
      })
    })
  } catch (error) {
    console.error('LINE notification error:', error)
  }
}

// LINE返信送信
async function sendLineReply(replyToken: string, message: string) {
  try {
    await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    })
  } catch (error) {
    console.error('LINE reply error:', error)
  }
}

// メインのWebhook処理
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const events = body.events || []
    
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId
        const message = event.message.text
        
        // ユーザーとテナント情報取得
        const { userInfo, tenantId } = await getUserWithTenant(userId)
        
        if (!userInfo || !tenantId) {
          await handleUnknownUser(event, userId, message)
          continue
        }
        
        // 役割に応じた処理
        if (userInfo.role === 'executive') {
          await handleExecutiveMessage(event, userId, message, userInfo, tenantId)
        } else {
          await handleEmployeeMessage(event, userId, message, userInfo, tenantId)
        }
      }
    }
    
    return NextResponse.json({ status: 'ok' })
    
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}