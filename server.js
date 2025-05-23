const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws'); //  ВАЖНО: Убедитесь, что эта строка ЕСТЬ

const app = express();
const PORT = 3000;

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
// Создание ApolloServer
const apolloServer = new ApolloServer({ typeDefs, resolvers });  // Создаем GraphQL-сервер

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
    console.log('Instance ID:', process.env.INSTANCE_ID);  // Для проверки балансировки

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
    console.log('Instance ID:', process.env.INSTANCE_ID);  // Для проверки балансировки

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
    console.log('Instance ID:', process.env.INSTANCE_ID);  // Для проверки балансировки

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
    console.log('Instance ID:', process.env.INSTANCE_ID);  // Для проверки балансировки
    writeProducts(products);
    res.status(204).send();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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

//  Создаем HTTP сервер
const server = http.createServer(app);

//  Создаем WebSocket сервер
const wss = new WebSocket.Server({ server });  //  ПЕРЕДАЕМ HTTP-сервер

wss.on('connection', ws => {
  console.log('Client connected');
  console.log('Instance ID:', process.env.INSTANCE_ID);  // Для проверки балансировки

  ws.on('message', message => {
    console.log(`Received: ${message}`);
    ws.send(`Server received: ${message}`); //  Эхо-ответ
  });

  wss.on('close', () => {
    console.log('Client disconnected');
  });

  wss.onerror = (error) => {
      console.error(`WebSocket Error: ${error}`);
  };
});


// Запуск сервера
apolloServer.start().then(() => {
    apolloServer.applyMiddleware({ app });
    server.listen(PORT, () => { // Corrected: server.listen()
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`GraphQL server ready at http://localhost:${PORT}${apolloServer.graphqlPath}`);
    });
});