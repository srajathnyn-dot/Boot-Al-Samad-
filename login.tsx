// ============================================
// صفحة تسجيل الدخول للوحة التحكم
// ============================================

export const loginPageHtml = (error?: string) => `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تسجيل الدخول - لوحة تحكم بوت كلية الصماد</title>
<link rel="icon" type="image/svg+xml" href="/static/icon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/static/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/static/favicon-16.png">
<link rel="apple-touch-icon" href="/static/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#065f46">
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Tajawal', sans-serif; }
  .gradient-bg {
    background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%);
  }
  .glass {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }
</style>
</head>
<body class="gradient-bg min-h-screen flex items-center justify-center p-4">

<div class="w-full max-w-md">
  <div class="text-center mb-8">
    <div class="inline-block p-5 bg-white/10 rounded-full backdrop-blur mb-4">
      <i class="fas fa-mosque text-5xl text-emerald-100"></i>
    </div>
    <h1 class="text-3xl font-bold text-white mb-2">لوحة تحكم البوت</h1>
    <p class="text-emerald-100">كلية الصماد للقرآن الكريم</p>
  </div>

  <div class="glass rounded-2xl p-8 shadow-2xl">
    ${error ? `
    <div class="bg-red-500/20 border border-red-300 text-red-100 px-4 py-3 rounded-lg mb-4 text-sm">
      <i class="fas fa-exclamation-circle ml-2"></i>${error}
    </div>` : ''}

    <form method="POST" action="/admin/login" class="space-y-5">
      <div>
        <label class="block text-emerald-100 text-sm mb-2 font-semibold">
          <i class="fas fa-user ml-1"></i> اسم المستخدم
        </label>
        <input type="text" name="username" required autofocus autocomplete="off"
          class="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-emerald-200/50 focus:outline-none focus:border-emerald-300 focus:bg-white/20 transition"
          placeholder="اسم المستخدم">
      </div>

      <div>
        <label class="block text-emerald-100 text-sm mb-2 font-semibold">
          <i class="fas fa-key ml-1"></i> كلمة المرور
        </label>
        <input type="password" name="password" required autocomplete="off"
          class="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white placeholder-emerald-200/50 focus:outline-none focus:border-emerald-300 focus:bg-white/20 transition"
          placeholder="••••••••">
      </div>

      <button type="submit"
        class="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-lg transition shadow-lg flex items-center justify-center gap-2">
        <i class="fas fa-sign-in-alt"></i> تسجيل الدخول
      </button>
    </form>

  </div>

  <p class="text-center text-emerald-200/70 text-xs mt-6">
    © 2026 كلية الصماد للقرآن الكريم — جميع الحقوق محفوظة
  </p>
</div>

</body>
</html>`;
