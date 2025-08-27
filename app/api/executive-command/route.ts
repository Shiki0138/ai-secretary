/**
 * 経営者コマンド処理API
 * 経営者から従業員への指示と思考パターン学習
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

// メッセージステータス
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

// 経営思考パターン

// 経営者の指示を解析
async function parseExecutiveCommand(message: string): Promise<{
  targetEmployee?: string
  command: string
  isDirectCommand: boolean
}> {
  // パターンマッチング（より柔軟に対応）
  const patterns = [
    /(.+?)(?:さん|くん|ちゃん)?に(.+?)(?:と)?(?:伝えて|言って|連絡して|知らせて)/,
    /(.+?)に対して(.+?)(?:を)?(?:伝えて|言って|連絡して|知らせて)/,
    /(.+?)へ(.+?)(?:を)?(?:送って|送信して)/,
    /(.+?)に(.+?)(?:を)?(?:お願い|頼んで|やってもらって|してもらって)/,
    /(.+?)に(.+)/  // 最も緩いパターン（「田中に〜」だけでもマッチ）
  ]
  
  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match) {
      const targetName = match[1].trim()
      const command = match[2].trim()
      
      // 従業員名っぽいかチェック（2-4文字で、明らかな指示語を含まない）
      const isLikelyEmployeeName = targetName.length >= 2 && targetName.length <= 4 && 
        !targetName.match(/(今日|明日|来週|至急|すぐ|早く|ちょっと)/);
      
      if (isLikelyEmployeeName) {
        return {
          targetEmployee: targetName,
          command: command,
          isDirectCommand: true
        }
      }
    }
  }
  
  return {
    command: message,
    isDirectCommand: false
  }
}

// 従業員を検索
async function findEmployee(
  tenantId: string, 
  searchName: string
): Promise<{ userId: string; name: string; department?: string } | null> {
  const employees = await redis.smembers(`tenant:${tenantId}:employees`) || []
  
  for (const employeeId of employees) {
    const employeeInfo = await redis.get(`tenant:${tenantId}:user:${employeeId}`) as Record<string, unknown>
    if (!employeeInfo) continue
    
    // 名前の部分一致検索
    if (employeeInfo.name && (employeeInfo.name as string).includes(searchName)) {
      return {
        userId: employeeInfo.userId as string,
        name: employeeInfo.name as string,
        department: employeeInfo.department as string
      }
    }
  }
  
  return null
}

// 経営思考を学習・記録
async function learnExecutiveThinking(
  tenantId: string,
  executiveId: string,
  message: string,
  context: string = 'general'
) {
  const learningKey = `tenant:${tenantId}:executive:${executiveId}:thinking`
  
  // GPT-4で思考パターンを分析
  try {
    const analysis = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "経営者の発言から、その思考パターン、価値観、判断基準を分析してください。"
        },
        {
          role: "user",
          content: `発言: "${message}"\nコンテキスト: ${context}`
        }
      ],
      response_format: { type: "json_object" }
    })
    
    const pattern = JSON.parse(analysis.choices[0].message.content || '{}')
    
    // パターンを保存
    await redis.lpush(learningKey, JSON.stringify({
      message,
      context,
      pattern,
      timestamp: new Date().toISOString()
    }))
    
    // 最新100件のみ保持
    await redis.ltrim(learningKey, 0, 99)
    
  } catch (error) {
    console.error('Learning error:', error)
  }
}

// 雑な指示を丁寧な依頼に変換
async function convertToPoliteRequest(
  roughCommand: string,
  employeeName: string
): Promise<string> {
  try {
    const prompt = `あなたは経営者の秘書です。経営者からの以下の雑な指示を、従業員への丁寧な依頼文に変換してください。

経営者からの指示: "${roughCommand}"
宛先: ${employeeName}様

以下の点に注意して変換してください：
- 敬語を使用する
- 「お疲れ様です」などの挨拶を含める
- 依頼内容を明確にする
- 期限がある場合は丁寧に伝える
- 「お忙しい中恐れ入りますが」などのクッション言葉を使う
- 最後に「よろしくお願いいたします」で締める
- 経営者からの依頼であることを明記する

出力フォーマット:
【${employeeName}様への連絡】

[ここに丁寧な依頼文を書いてください]

※このメッセージは経営者からの指示をAI秘書が伝達しています。`

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは有能な秘書として、経営者の指示を従業員に丁寧に伝える専門家です。"
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 500
    })

    return response.choices[0].message.content || `【${employeeName}様への連絡】\n\nお疲れ様です。経営者より以下の依頼がございます。\n\n${roughCommand}\n\nお忙しい中恐れ入りますが、どうぞよろしくお願いいたします。\n\n※このメッセージは経営者からの指示をAI秘書が伝達しています。`
    
  } catch (error) {
    console.error('Polite conversion error:', error)
    // エラー時のフォールバック
    return `【${employeeName}様への連絡】\n\nお疲れ様です。経営者より以下の依頼がございます。\n\n${roughCommand}\n\nお忙しい中恐れ入りますが、どうぞよろしくお願いいたします。\n\n※このメッセージは経営者からの指示をAI秘書が伝達しています。`
  }
}

// 経営者の思考を推測
async function predictExecutiveResponse(
  tenantId: string,
  executiveId: string,
  question: string
): Promise<{
  prediction: string
  confidence: number
  basedOn: string[]
}> {
  const learningKey = `tenant:${tenantId}:executive:${executiveId}:thinking`
  const patterns = await redis.lrange(learningKey, 0, 50) || []
  
  if (patterns.length < 5) {
    return {
      prediction: "まだ十分な学習データがありません。",
      confidence: 0,
      basedOn: []
    }
  }
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `あなたは経営者の思考パターンを学習したAI秘書です。
過去の発言パターンから、経営者がどのように回答するかを推測してください。`
        },
        {
          role: "user",
          content: `
過去の経営者の発言パターン:
${patterns.slice(0, 10).join('\n')}

質問: ${question}

この質問に対して、経営者はどのように回答すると予想されますか？
確信度（0-100）も含めて回答してください。`
        }
      ],
      response_format: { type: "json_object" }
    })
    
    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    return {
      prediction: result.prediction || "推測できません",
      confidence: result.confidence || 0,
      basedOn: result.basedOn || []
    }
    
  } catch (error) {
    console.error('Prediction error:', error)
    return {
      prediction: "推測エラーが発生しました",
      confidence: 0,
      basedOn: []
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json()
    
    switch (action) {
      case 'send_to_employee': {
        const { tenantId, executiveId, message } = data
        
        // 指示を解析
        const parsed = await parseExecutiveCommand(message)
        
        if (!parsed.isDirectCommand) {
          return NextResponse.json({
            error: '従業員への指示が認識できませんでした。「〇〇さんに〜と伝えて」の形式でお願いします。'
          }, { status: 400 })
        }
        
        // 従業員を検索
        const employee = await findEmployee(tenantId, parsed.targetEmployee!)
        
        if (!employee) {
          return NextResponse.json({
            error: `「${parsed.targetEmployee}」という従業員が見つかりませんでした。`
          }, { status: 404 })
        }
        
        // メッセージ送信記録
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const messageStatus: MessageStatus = {
          messageId,
          from: executiveId,
          to: employee.name,
          toUserId: employee.userId,
          content: parsed.command,
          sentAt: new Date().toISOString(),
          status: 'sent'
        }
        
        // ステータス保存
        await redis.set(
          `tenant:${tenantId}:message:${messageId}`,
          messageStatus,
          { ex: 86400 * 30 } // 30日間保存
        )
        
        // 雑な指示を丁寧な依頼に変換
        const politeMessage = await convertToPoliteRequest(parsed.command, employee.name)
        
        // 従業員に通知
        await sendLineNotification(employee.userId, politeMessage
        )
        
        // 経営思考を学習
        await learnExecutiveThinking(tenantId, executiveId, message, 'command')
        
        // 簡潔な要約メッセージを経営者に返す
        const executiveSummary = `${employee.name}さんに指示を送信しました。\n\n【あなたの指示】\n「${parsed.command}」\n\n【送信内容】\n丁寧なビジネスマナーに沿った形で伝達しました。`
        
        return NextResponse.json({
          message: executiveSummary,
          messageId,
          employee,
          actualMessage: politeMessage // デバッグ用（実際の送信内容）
        })
      }
      
      case 'predict_response': {
        const { tenantId, executiveId, question } = data
        
        const prediction = await predictExecutiveResponse(tenantId, executiveId, question)
        
        return NextResponse.json({
          question,
          prediction: prediction.prediction,
          confidence: prediction.confidence,
          disclaimer: prediction.confidence < 70 
            ? "※確信度が低いため、実際の判断とは異なる可能性があります"
            : "※過去のパターンに基づく推測です"
        })
      }
      
      case 'get_message_status': {
        const { tenantId, messageId } = data
        
        const status = await redis.get(`tenant:${tenantId}:message:${messageId}`) as MessageStatus
        
        if (!status) {
          return NextResponse.json({
            error: 'Message not found'
          }, { status: 404 })
        }
        
        return NextResponse.json(status)
      }
      
      case 'get_sent_messages': {
        const { tenantId, executiveId } = data
        
        try {
          // 送信したメッセージのリストを取得
          const messageKeys = await redis.keys(`tenant:${tenantId}:message:*`)
          const messages = []
          
          for (const key of messageKeys) {
            const message = await redis.get(key) as MessageStatus
            if (message && message.from === executiveId) {
              messages.push(message)
            }
          }
          
          // 送信日時で降順ソート
          messages.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
          
          return NextResponse.json({
            messages
          })
        } catch (error) {
          return NextResponse.json({
            error: 'Failed to get sent messages',
            details: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 })
        }
      }

      case 'update_message_status': {
        const { tenantId, messageId, newStatus, replyContent } = data
        
        const status = await redis.get(`tenant:${tenantId}:message:${messageId}`) as MessageStatus
        
        if (!status) {
          return NextResponse.json({
            error: 'Message not found'
          }, { status: 404 })
        }
        
        // ステータス更新
        status.status = newStatus
        
        if (newStatus === 'read') {
          status.readAt = new Date().toISOString()
        } else if (newStatus === 'replied' && replyContent) {
          status.replyContent = replyContent
          status.repliedAt = new Date().toISOString()
        }
        
        await redis.set(
          `tenant:${tenantId}:message:${messageId}`,
          status,
          { ex: 86400 * 30 }
        )
        
        // 経営者に通知
        if (newStatus === 'read' || newStatus === 'replied') {
          await notifyExecutiveAboutStatus(tenantId, status)
        }
        
        return NextResponse.json({
          message: 'Status updated',
          status
        })
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 })
    }
    
  } catch (error) {
    console.error('Executive command error:', error)
    return NextResponse.json({
      error: 'Command processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
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

// 経営者にステータス通知
async function notifyExecutiveAboutStatus(tenantId: string, status: MessageStatus) {
  const executives = await redis.smembers(`tenant:${tenantId}:executives`) || []
  
  let notification = ''
  
  if (status.status === 'read') {
    notification = `✓ ${status.to}さんがメッセージを確認しました\n\n内容:「${status.content}」`
  } else if (status.status === 'replied') {
    notification = `💬 ${status.to}さんから返信がありました\n\n送信内容:「${status.content}」\n\n返信:「${status.replyContent}」`
  }
  
  for (const execId of executives) {
    if (execId === status.from) {
      await sendLineNotification(execId, notification)
    }
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    actions: {
      send_to_employee: 'Send message to employee',
      predict_response: 'Predict executive response based on patterns',
      get_message_status: 'Get message delivery status',
      get_sent_messages: 'Get executive sent messages list',
      update_message_status: 'Update message status (read/replied)'
    }
  })
}