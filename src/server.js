import express from 'express'
import cors from 'cors'

const server = express()
server.use(cors)



const PORT = 5000
server.listen(5000, () => {console.log(`Servidor rodando na porta ${PORT}`)})