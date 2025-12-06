#!/bin/bash

# PadiPay Admin Dashboard - Quick Start Script

echo "🚀 PadiPay Admin Dashboard - Quick Start"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local file not found"
    echo "📝 Creating .env.local from template..."
    
    if [ -f .env.local.example ]; then
        cp .env.local.example .env.local
        echo "✅ Created .env.local"
        echo ""
        echo "⚠️  Please update .env.local with your Firebase credentials:"
        echo "   - NEXT_PUBLIC_FIREBASE_API_KEY"
        echo "   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
        echo "   - NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        echo "   - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
        echo "   - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
        echo "   - NEXT_PUBLIC_FIREBASE_APP_ID"
        echo ""
    fi
fi

# Start development server
echo "🎯 Starting development server..."
echo ""
echo "📋 Available scripts:"
echo "   npm run dev     - Start development server"
echo "   npm run build   - Build for production"
echo "   npm start       - Run production build"
echo "   npm run lint    - Run linter"
echo ""
echo "🌐 Dashboard will be available at: http://localhost:3000"
echo ""

npm run dev
