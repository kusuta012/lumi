# LUMI

Lumi is a self-hosted media management platform with face recognition, semantic search, and much more! Its very easy to self-host, it can run on A mini pc, Laptops, Servers, Rassberry Pi's.

# What makes Lumi special?

Lumi is highly customizable, It has a admin dashboard where you could view and manage your server like storage, worker's queues. 
Manage users, set storage limits, suspend a user. Lumi has roles, you could promote anyone to admin, (only super admin can do this). You can make your own custom roles.

# Why Did I build this project?

I've always been fascinated by self-hosting, Its one of the greatest thing to tinker with cause you have the control over it. Your data is in your hands and its much more fun when you can customize it as you like. Just need a cheap 5$ server or even a old laptop and it works! I built lumi as a project to learn more about how is it like to make production level selfhostable app. It was very interesting and a great learning to build lumi, I learned a lot about how ML works, how its like to manage multiple services and connecting the dots , making sure everything stays in sync and smooth.

# Features

- **Face Recogniton** - Faces are detected and clustered and grouped into people who you could merge , rename , hide.

- **Hybrid Search** - It combines text, context, natural language , location, metadata, and people all into a single search bar

- **Collabrative Albums** - Create albums, invite contributors with role based perms (viwer, contributor, co-owner) and share via password protected public links and optional expiry.

- **Admin Dashboard** - Manage users , roles, storage backends , background jobs queues, features flippers and audit logs.

- **Explore & Map** - Browse your library by people , plces and recent highlights. View all geotagged media on a interactive map.

- **Hardware Adaptive** - It literally runs on a Raspberry Pi, a mini PC, a laptop.

# Tech Stack 

Frontend - Next.js, React
Backend - Next.js server actions , Drizzle ORM,
Database - PostgreSQL (pgvector), pgbouncer
Storage - Any S3-Compatible (MinIo, AWS S3, etc)
AI/ML - Python, CLIP, ViT
Jobs - Bullmq, Redis 

# Instructions

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) v18+

### 1. Clone and install

```bash
git clone https://github.com/kusuta012/lumi.git
cd lumi
npm install
```

### 2. Configure Env

```bash
cp .env.example .env
```

(*Note* - Make sure to edit these before proceeding)

### 3. Starting Lumi!

```bash
docker compose up -d --build
```

### 4. Push Database schema

```bash
npx drizzle-kit push
```

### 5. Launch 

```bash
npm run build
npm start
```

# Images


