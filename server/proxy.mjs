import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { apiBaseUrl, apiKey, model, messages, temperature, max_tokens } = req.body

    if (!apiKey) {
      return res.status(400).json({ error: '请先配置 API Key' })
    }

    const url = `${apiBaseUrl}/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `API 调用失败 (${response.status})`,
      })
    }

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message || '服务器错误' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`AI 代理服务已启动: http://localhost:${PORT}`)
})
