/**
 * LINE Bot Webhook API v3 - 自律的秘書システム
 * カレンダー連携・承認フロー対応版
 */

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import OpenAI from 'openai'

// サービス初期化
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// 型定義
type UserRole = 'executive' | 'employee' | 'unknown'
type ActionType = 'schedule' | 'approval' | 'direct' | 'information'

interface MessageAnalysis {
  priority: 'urgent' | 'high' | 'normal' | 'low'
  category: 'report' | 'consultation' | 'proposal' | 'issue' | 'request' | 'schedule'
  summary: string
  requiredAction: string
  sentiment: 'positive' | 'neutral' | 'negative'
  intent: string
  actionType: ActionType
  requiresApproval: boolean
}

// カレンダーアクセス（モック実装）
async function getExecutiveSchedule(_executiveId: string): Promise<Array<{time: string, available: boolean}>> {
  // 実際の実装では Google Calendar API を使用
  const mockSchedule = [
    { time: '今日 15:00-16:00', available: true },
    { time: '明日 10:00-11:00', available: true },
    { time: '明日 14:00-15:00', available: false },
    { time: '木曜 14:00-15:00', available: true },
    { time: '金曜 10:00-11:00', available: true },
    { time: '来週月曜 16:00-17:00', available: true }
  ]
  
  // 利用可能な時間帯のみ返す
  return mockSchedule.filter(slot => slot.available)
}

// タスク情報取得（モック実装）
async function getExecutiveTasks(_executiveId: string): Promise<Array<{task: string, deadline: string, priority: string}>> {
  // 実際の実装では Task DB から取得
  return [
    { task: '予算承認', deadline: '今週金曜', priority: 'high' },
    { task: '採用面接', deadline: '来週', priority: 'normal' },
    { task: '戦略会議準備', deadline: '今月末', priority: 'high' }
  ]
}

// 高度な従業員メッセージ分析
async function analyzeEmployeeMessageAdvanced(message: string, userInfo: Record<string, unknown> | null): Promise<MessageAnalysis> {
  try {
    const prompt = `あなたは経営者の有能な秘書です。従業員からのメッセージを分析し、適切なアクションを判断してください。

従業員情報:
- 名前: ${userInfo?.name || '不明'}
- 部署: ${userInfo?.department || '不明'}

メッセージ: ${message}

以下のJSON形式で分析結果を返してください:
{
  "priority": "urgent/high/normal/low",
  "category": "report/consultation/proposal/issue/request/schedule",
  "summary": "要約（30字以内）",
  "requiredAction": "秘書が取るべき具体的アクション",
  "sentiment": "positive/neutral/negative",
  "intent": "詳細な意図",
  "actionType": "schedule（日程調整）/approval（承認必要）/direct（直接対応）/information（情報提供）",
  "requiresApproval": true/false（経営者の事前承認が必要か）
}`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは経営者の秘書として、自律的に判断し行動できる有能なアシスタントです。"
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" }
    })

    return JSON.parse(response.choices[0].message.content || '{}')
    
  } catch (error) {
    console.error('Advanced analysis error:', error)
    return {
      priority: 'normal',
      category: 'request',
      summary: message.substring(0, 30),
      requiredAction: '確認が必要です',
      sentiment: 'neutral',
      intent: '不明',
      actionType: 'direct',
      requiresApproval: false
    }
  }
}

// 自律的アクション実行
async function executeAutonomousAction(
  analysis: MessageAnalysis,
  message: string,
  userInfo: Record<string, unknown> | null,
  userId: string
): Promise<string> {
  
  switch (analysis.actionType) {
    case 'schedule': {
      // カレンダー確認と日程提案
      const availableSlots = await getExecutiveSchedule('default')
      
      if (availableSlots.length === 0) {
        return `${userInfo?.name || ''}様、申し訳ございません。

現在、社長のスケジュールが大変込み合っております。
来週以降で改めて日程を確認させていただきます。

緊急の案件でしたら、その旨お知らせください。`
      }
      
      const slotsList = availableSlots
        .slice(0, 3)
        .map(slot => `・${slot.time}`)
        .join('\n')
      
      return `${userInfo?.name || ''}様、承知いたしました。

社長のスケジュールを確認しましたところ、以下の時間帯が空いております：

${slotsList}

いずれかでご都合はいかがでしょうか？
また、相談内容を簡単にお聞かせいただければ、より適切な時間配分をご提案できます。`
    }
    
    case 'approval': {
      // 承認が必要な案件
      await createApprovalRequest(userId, message, analysis, userInfo)
      
      return `${userInfo?.name || ''}様、ご相談ありがとうございます。

「${analysis.summary}」について承りました。

この件は経営判断が必要な内容ですので、社長に確認を取らせていただきます。
通常、1営業日以内に回答させていただきますが、緊急の場合はその旨お知らせください。

確認が取れ次第、ご連絡いたします。`
    }
    
    case 'information': {
      // 情報提供（タスク状況など）
      const tasks = await getExecutiveTasks('default')
      
      if (message.includes('タスク') || message.includes('予定')) {
        const taskList = tasks
          .map(t => `・${t.task}（期限：${t.deadline}）`)
          .join('\n')
        
        return `現在の社長の主要タスクは以下の通りです：

${taskList}

特定のタスクについて詳細が必要でしたら、お知らせください。`
      }
      
      return `${userInfo?.name || ''}様、お問い合わせありがとうございます。

情報を確認し、改めてご連絡させていただきます。`
    }
    
    default: {
      // 直接対応
      return `${userInfo?.name || ''}様、ご連絡ありがとうございます。

「${analysis.summary}」について承知いたしました。

${analysis.requiredAction}

何か追加でご質問がございましたら、お知らせください。`
    }
  }
}

// 承認リクエスト作成
async function createApprovalRequest(
  employeeId: string,
  originalMessage: string,
  analysis: MessageAnalysis,
  employeeInfo: Record<string, unknown> | null
): Promise<void> {
  
  const approvalRequest = {
    id: `approval_${Date.now()}`,
    employeeId,
    employeeName: employeeInfo?.name || '不明',
    department: employeeInfo?.department || '不明',
    originalMessage,
    analysis,
    proposedResponse: await generateProposedResponse(originalMessage, analysis, employeeInfo),
    status: 'pending',
    createdAt: new Date().toISOString()
  }
  
  // 承認リクエストを保存
  await redis.lpush('approval_requests', JSON.stringify(approvalRequest))
  await redis.set(`approval:${approvalRequest.id}`, approvalRequest, { ex: 86400 * 3 })
  
  // 経営者に通知
  await notifyExecutiveForApproval(approvalRequest)
}

// 提案回答生成
async function generateProposedResponse(
  message: string,
  analysis: MessageAnalysis,
  employeeInfo: Record<string, unknown> | null
): Promise<string> {
  
  const prompt = `従業員からの以下の相談に対する適切な回答を作成してください。

従業員: ${employeeInfo?.name}（${employeeInfo?.department}）
相談内容: ${message}
分析: ${analysis.summary}

プロフェッショナルで建設的な回答を作成してください。`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは経営者の代理として適切な判断と回答を行う秘書です。"
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 300
    })
    
    return response.choices[0].message.content || ''
  } catch {
    return '適切な対応を検討いたします。'
  }
}

// 経営者への承認依頼通知
async function notifyExecutiveForApproval(approvalRequest: Record<string, unknown>) {
  const executives = await redis.smembers('executives') || []
  
  for (const executiveId of executives) {
    const notification = `📋 承認依頼

【相談者】${approvalRequest.employeeName}（${approvalRequest.department}）

【内容】
${approvalRequest.originalMessage}

【提案回答】
${approvalRequest.proposedResponse}

承認する場合：「承認 ${approvalRequest.id}」
修正する場合：「修正 ${approvalRequest.id} [修正内容]」
却下する場合：「却下 ${approvalRequest.id} [理由]」`

    // 実際のLINE通知送信
    await sendLineNotification(executiveId, notification)
  }
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

// ユーザー役割取得（v2から継承）
async function getUserRole(userId: string): Promise<{ role: UserRole; userInfo: Record<string, unknown> | null }> {
  try {
    const userInfo = await redis.get(`user:${userId}`)
    
    if (userInfo && typeof userInfo === 'object') {
      const userInfoObj = userInfo as Record<string, unknown>
      const executives = await redis.smembers('executives') || []
      if (executives.includes(userId)) {
        return { role: 'executive', userInfo: userInfoObj }
      }
      
      if ('role' in userInfoObj) {
        if (userInfoObj.role === 'executive' || userInfoObj.role === '経営者' || userInfoObj.role === 'CEO' || userInfoObj.role === '社長') {
          return { role: 'executive', userInfo: userInfoObj }
        }
      }
      
      return { role: 'employee', userInfo: userInfoObj }
    }
    
    return { role: 'unknown', userInfo: null }
    
  } catch (error) {
    console.error('User role detection error:', error)
    return { role: 'unknown', userInfo: null }
  }
}

// 経営者メッセージ処理（承認対応追加）
async function handleExecutiveMessage(
  event: Record<string, unknown>,
  userId: string,
  message: string
) {
  // 承認コマンドチェック
  if (message.startsWith('承認 ') || message.startsWith('修正 ') || message.startsWith('却下 ')) {
    await handleApprovalCommand(event, userId, message)
    return
  }
  
  // 通常の経営者メッセージ処理
  const prompt = `経営者からの指示: ${message}

適切な秘書としての返答を作成してください。`

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは有能な秘書として、経営者の指示に的確に応えます。"
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 300
    })
    
    const replyMessage = response.choices[0].message.content || '承知いたしました。'
    await sendLineReply(event.replyToken, replyMessage)
    
  } catch {
    await sendLineReply(event.replyToken, '承知いたしました。対応いたします。')
  }
}

// 承認コマンド処理
async function handleApprovalCommand(
  event: Record<string, unknown>,
  executiveId: string,
  command: string
) {
  const parts = command.split(' ')
  const action = parts[0]
  const approvalId = parts[1]
  const additionalInfo = parts.slice(2).join(' ')
  
  const approvalRequest = await redis.get(`approval:${approvalId}`)
  
  if (!approvalRequest) {
    await sendLineReply(event.replyToken, '該当する承認依頼が見つかりません。')
    return
  }
  
  const request = approvalRequest as Record<string, unknown>
  
  switch (action) {
    case '承認':
      // 従業員に提案回答を送信
      await sendLineNotification(request.employeeId, request.proposedResponse)
      await sendLineReply(event.replyToken, '承認しました。従業員に回答を送信しました。')
      break
      
    case '修正':
      // 修正内容で従業員に回答
      await sendLineNotification(request.employeeId, additionalInfo || request.proposedResponse)
      await sendLineReply(event.replyToken, '修正内容で回答しました。')
      break
      
    case '却下':
      // 却下理由を含めて従業員に回答
      const rejectMessage = `申し訳ございません。ご相談いただいた件について、
${additionalInfo || '現時点では対応が難しい状況です。'}

別の方法をご検討いただくか、改めてご相談ください。`
      await sendLineNotification(request.employeeId, rejectMessage)
      await sendLineReply(event.replyToken, '却下理由を従業員に伝えました。')
      break
  }
  
  // 承認リクエストを処理済みに
  await redis.del(`approval:${approvalId}`)
}

// 従業員メッセージ処理（自律的アクション対応）
async function handleEmployeeMessage(
  event: Record<string, unknown>,
  userId: string,
  message: string,
  userInfo: Record<string, unknown> | null
) {
  // 高度な分析
  const analysis = await analyzeEmployeeMessageAdvanced(message, userInfo)
  
  // メッセージ保存
  const messageData = {
    id: Date.now().toString(),
    userId,
    userRole: 'employee',
    message,
    analysis,
    timestamp: new Date().toISOString()
  }
  
  await redis.lpush('employee_messages', JSON.stringify(messageData))
  
  // 自律的アクション実行
  const replyMessage = await executeAutonomousAction(analysis, message, userInfo, userId)
  
  // LINE返信
  await sendLineReply(event.replyToken, replyMessage)
  
  // 高優先度の場合は経営者に通知（承認不要な場合）
  if (analysis.priority === 'urgent' && !analysis.requiresApproval) {
    const notification = `⚡ 緊急報告

${userInfo?.name}（${userInfo?.department}）より：
${message}

【対応済み内容】
${replyMessage}`

    const executives = await redis.smembers('executives') || []
    for (const execId of executives) {
      await sendLineNotification(execId, notification)
    }
  }
}

// 未登録ユーザー処理（v2から継承）
async function handleUnknownUser(event: Record<string, unknown>, userId: string, message: string) {
  // 自動登録の試み
  const registrationPattern = /(.+)です。(.+)の(.+)[をしています|です]/
  const match = message.match(registrationPattern)
  
  if (match) {
    const name = match[1]
    const company = match[2]
    const roleOrPosition = match[3]
    
    const isExecutive = ['CEO', '社長', '経営者', '代表'].some(keyword => 
      roleOrPosition.includes(keyword)
    )
    
    // 自動登録
    const userInfo = {
      userId,
      name,
      company,
      department: roleOrPosition.includes('部') ? roleOrPosition : '',
      role: isExecutive ? 'executive' : 'employee',
      registeredAt: new Date().toISOString()
    }
    
    await redis.set(`user:${userId}`, userInfo)
    
    if (isExecutive) {
      await redis.sadd('executives', userId)
    } else {
      await redis.sadd('employees', userId)
    }
    
    const roleText = isExecutive ? '経営者' : '従業員'
    await sendLineReply(
      event.replyToken,
      `${name}様、はじめまして。
      
AI秘書システムへようこそ。
${roleText}として登録させていただきました。

どのようなご用件でしょうか？`
    )
    
    return
  }
  
  // 自動登録できない場合
  const replyMessage = `はじめまして。AI秘書システムです。

ご利用を開始するには、以下の情報をお送りください：
1. お名前
2. 会社名・部署
3. 役職

例：「山田太郎です。ABC商事の営業部で部長をしています。」`

  await sendLineReply(event.replyToken, replyMessage)
}

// LINE返信送信（v2から継承）
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
        
        const { role, userInfo } = await getUserRole(userId)
        
        if (role === 'unknown') {
          await handleUnknownUser(event, userId, message)
        } else if (role === 'executive') {
          await handleExecutiveMessage(event, userId, message, userInfo)
        } else {
          await handleEmployeeMessage(event, userId, message, userInfo)
        }
      }
    }
    
    return NextResponse.json({ status: 'ok' })
    
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}