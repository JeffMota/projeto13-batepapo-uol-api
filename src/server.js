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


//Remoção automática de usuários inativos
setInterval(async () => {

    const users = await db.collection('participants').find().toArray()

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

}, 15000)

const PORT = 5000

server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`))