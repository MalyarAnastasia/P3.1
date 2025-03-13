const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;


// Создаем WebSocket сервер
const wss = new WebSocket.Server({ noServer: true });

// Обработчик для новых подключений WebSocket
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    // Обработчик для получения сообщений от клиента
    ws.on('message', (message) => {
        console.log(`Received message: ${message}`);

        // Отправляем сообщение всем подключенным клиентам
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    // Отправляем приветственное сообщение новому клиенту
    ws.send('Welcome to the chat!');
});



const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Swagger документация
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Task Management API',
            version: '1.0.0',
            description: 'API для управления задачами',
        },
        servers: [
            {
                url: 'http://localhost:8080',
            },
        ],
    },
    apis: [path.join(__dirname, 'openapi.yaml')], // укажите путь к файлам с аннотациями
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

//реализация GrapfQL
const typeDefs = gql`
  type products {
    id: Int
    name: String
    prise: Int
    description: String
    categories: String
  }

  type Query {
    products(id: Int): [products]
  }
`;

  const resolvers = {
    Query: {
        products: (parent, args) => {
            const products = readProducts();
            if (args.id) {
                return products.filter(product => product.id === args.id);
            }
            return products;
        },
    },
};

const server = new ApolloServer({ typeDefs, resolvers });

// Middleware для парсинга JSON
app.use(bodyParser.json());

// путь к файлу, где хранятся товары
const productsFilePath = path.join(__dirname, 'products.json');

// Чтение товаров из файла
const readProducts = () => {
    const data = fs.readFileSync(productsFilePath);
    return JSON.parse(data);
};

// Записать товары в файл
const writeProducts = (products) => {
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
};

// Эндпоинт для получения списка товаров с фильтрацией по категориям
app.get('/products', (req, res) => {
    const { category } = req.query;
    const products = readProducts();
    
    if (category) {
        // Фильтруем товары по категориям
        const filteredProducts = products.filter(product => product.categories.includes(category));
        return res.json(filteredProducts);
    }

    res.json(products);
});


// Эндпоинт для добавления одного или нескольких товаров
app.post('/products', (req, res) => {
    const products = readProducts();
    const newProducts = Array.isArray(req.body) ? req.body : [req.body]; // Проверяем, массив или объект

    const addedProducts = newProducts.map((product, index) => {
        const { name, price, description, categories } = product;

        // Создаем новый товар с уникальным ID
        const newProduct = {
            id: products.length + 1 + index,
            name,
            price,
            description,
            categories,
        };

        products.push(newProduct);
        return newProduct;
    });

    writeProducts(products);

    res.status(201).json({
        message: `${addedProducts.length} товар(ов) успешно добавлено.`,
        products: addedProducts
    });
});


// Эндпоинт для редактирования товара по ID
app.put('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const { name, price, description, categories } = req.body;
    const products = readProducts();
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ message: 'Product not found' });
    }

    const updatedProduct = {
        ...products[productIndex],
        name: name || products[productIndex].name,
        price: price || products[productIndex].price,
        description: description || products[productIndex].description,
        categories: categories || products[productIndex].categories,
    };

    products[productIndex] = updatedProduct;
    writeProducts(products);
    res.json(updatedProduct);
});

// Эндпоинт для удаления товара по ID
app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    let products = readProducts();
    products = products.filter(p => p.id !== productId);
    writeProducts(products);
    res.status(204).send();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
  

// Запуск сервера
server.start().then(() => {
    server.applyMiddleware({ app });
    app.listen(PORT, () => {
    console.log("Server is running on http://localhost:", PORT);
    console.log(`GraphQL server ready at http://localhost:${PORT}${server.graphqlPath}`);
    });
});

