import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import joi from 'joi'
dotenv.config()

const server = express()
server.use(cors())
server.use(express.json())

const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {

    await mongoClient.connect()
    console.log('Servidor conectado!')

} catch (err) {
    console.log("Não foi possivel se conectar ao banco de dados")
}

const db = mongoClient.db()

//Buscar todos os participantes
server.get("/participants", async (req, res) => {

    try {
        const users = await db.collection('participants').find().toArray()
        res.send(users)

    } catch (error) {
        console.log(error.message)
    }
})

//Cadastrando participante
server.post("/participants", async (req, res) => {
    const part = req.body

    //Validação
    const userSchema = joi.object({
        name: joi.string().required()
    })

    const validation = userSchema.validate(part, { abortEarly: false })

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    }

    const alreadyExists = await db.collection('participants').findOne({ name: part.name })
    if (alreadyExists) return res.status(409).send('Usuário já cadastrado')

    try {

        await db.collection('participants').insertOne({ name: part.name, lastStatus: Date.now() })

        await db.collection('messages').insertOne(
            {
                from: part.name,
                to: 'Todos',
                text: 'entra na sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            })

        res.sendStatus(201)

    } catch (error) {
        res.status(500).send('Não foi possivel se cadastrar')
    }

})


//Buscar todas as mensagen
server.get('/messages', async (req, res) => {
    const { user } = req.headers
    const { limit } = Number(req.query)

    const headSchema = joi.object({
        user: joi.string().required(),
        limit: joi.number().min(1)
    })

    const validation = headSchema.validate({ user: user, limit: limit }, { abortEarly: false })

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    }

    try {

        const messages = await db.collection('messages').find().toArray()

        let filteredMsg = []
        messages.forEach(msg => {
            if (msg.to === 'Todos' || msg.to === user || msg.from === user) {
                filteredMsg.push(msg)
            }
        })

        if (limit) {
            return res.send(filteredMsg.reverse().slice(-limit))
        }
        res.send(filteredMsg)

    } catch (error) {
        console.log(error.message)
    }
})

//Envio de mensagem
server.post('/messages', async (req, res) => {
    const { user } = req.headers
    const msg = req.body

    if (!user || user === '') return res.status(422)

    //Verificando usuário
    try {
        const userExist = await db.collection('participants').findOne({ name: user })
        if (!userExist) return db.status(422).send('Você não está logado!')

    } catch (error) {
        return res.status(500).send('Não foi possível verificar usuário')
    }

    const msgSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    })

    const validation = msgSchema.validate(msg, { abortEarly: false })

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    }

    try {
        await db.collection('messages').insertOne(
            {
                from: user,
                to: msg.to,
                text: msg.text,
                type: msg.type,
                time: dayjs().format('HH:mm:ss')
            }
        )

        return res.sendStatus(201)

    } catch (error) {
        return res.status(500).send('Não foi possível enviar mensagem')
    }

})

//Status do usuário
server.post('/status', async (req, res) => {
    const { user } = req.headers

    let userExist = await db.collection('participants').findOne({ name: user })
    if (!userExist) {
        return res.sendStatus(404)
    }

    try {
        userExist.lastStatus = Date.now()
        const result = await db.collection('participants').updateOne({ name: user }, { $set: userExist })

        res.sendStatus(200)

    } catch (error) {

    }

})

//Remoção automática de usuários inativos
setInterval(async () => {

    const users = await db.collection('participants').find().toArray()

    if (users.length > 0) {
        users.forEach(async user => {
            if ((Date.now() - user.lastStatus) > 10000) {
                await db.collection('participants').deleteOne({ name: user.name })

                db.collection('messages').insertOne(
                    {
                        from: user.name,
                        to: 'Todos',
                        text: 'sai da sala...',
                        type: 'status',
                        time: dayjs().format('HH:mm:ss')
                    })
            }
        })
    }

}, 15000)

const PORT = 5000

server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`))