// ══════════════════════════════════════════════════════════════
//  AUTH MANAGER — Ata Chess Giriş / Kayıt Sistemi
//  JSONBin.io Entegrasyonu & Admin Yönetimi
// ══════════════════════════════════════════════════════════════

const Auth = (() => {

    // ── JSONBin.io Yapılandırması ────────────────────────────────
    const BINS = [
        {
            id:  '6ab82a6cffd5d160533281c7',
            key: '$2a$10$ecSeOOWU9imzvcnW3L2mX.fjM.QuKjntw65PwRI.peTfcWEMaZIwi'
        },
        {
            id:  '69ac7f1dae596e708f6a551e',
            key: '$2a$10$7HfyIBbPBvwjjk4.MdOlkO1.aoOJN4enNO1QJ3LSXQjniMxyGXkp6'
        }
    ];

    const BASE_URL = 'https://api.jsonbin.io/v3/b';
    const SESSION_KEY = 'ata_chess_session';

    function getHeaders(binIndex) {
        const bin = BINS[binIndex];
        return {
            'X-Master-Key': bin.key,
            'X-Access-Key': bin.key
        };
    }

    // ── SHA-256 Hash Yardımcısı ──────────────────────────────────
    async function sha256(text) {
        if (!crypto || !crypto.subtle) {
            let h = 0;
            for (let i = 0; i < text.length; i++) {
                h = ((h << 5) - h) + text.charCodeAt(i);
                h |= 0;
            }
            return 'h_' + Math.abs(h).toString(16);
        }
        const buf = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(text)
        );
        return Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    // ── JSONBin okuma ────────────────────────────────────────────
    async function readBin(binIndex) {
        const bin = BINS[binIndex];
        const res = await fetch(`${BASE_URL}/${bin.id}/latest`, {
            headers: getHeaders(binIndex),
            cache: 'no-store'
        });
        if (!res.ok) throw new Error(`Bin ${binIndex} okunamadı: ${res.status}`);
        const data = await res.json();
        return data.record || {};
    }

    // ── JSONBin yazma ────────────────────────────────────────────
    async function writeBin(binIndex, record) {
        const bin = BINS[binIndex];
        const res = await fetch(`${BASE_URL}/${bin.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getHeaders(binIndex)
            },
            body: JSON.stringify(record)
        });
        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            throw new Error(`Bin ${binIndex} yazılamadı: ${res.status} ${errBody}`);
        }
        return res.json();
    }

    // ── Kullanıcı Listesini Çıkarma ─────────────────────────────
    function extractUsers(data) {
        if (!data) return [];
        const rec = data.record !== undefined ? data.record : data;
        if (Array.isArray(rec)) return rec;
        if (Array.isArray(rec.users)) return rec.users;
        if (Array.isArray(rec.kullanicilar)) return rec.kullanicilar;
        if (Array.isArray(rec.accounts)) return rec.accounts;
        if (rec && typeof rec === 'object' && rec.username) return [rec];
        return [];
    }

    // ── Tüm Bin'lerden Kullanıcıları Al ─────────────────────────
    async function getAllUsers() {
        const results = await Promise.allSettled([readBin(0), readBin(1)]);
        let all = [];
        results.forEach((r, i) => {
            if (r.status === 'fulfilled') {
                const list = extractUsers(r.value);
                all = all.concat(list);
            } else {
                console.warn(`[Auth] Bin ${i} okunamadı:`, r.reason);
            }
        });

        // Sabit / Yetkili Dahili Kullanıcılar
        const BUILTIN_USERS = [
            {
                username: "Furkan",
                rawUsername: "Furkan",
                nickname: "Apouyusiken",
                password: "Furkan173",
                passwordHash: "76ecff808a4579330d6a0ff6524145dec0a9bc7fcdde8e179f4d15fa88350411",
                isAdmin: false,
                role: "user",
                createdAt: "2026-09-28T21:47:52.599Z"
            }
        ];
        all = all.concat(BUILTIN_USERS);

        // Tekilleştir
        const seen = new Set();
        return all.filter(u => {
            if (!u || !u.username) return false;
            const norm = String(u.username).trim().toLowerCase();
            if (seen.has(norm)) return false;
            seen.add(norm);
            return true;
        });
    }

    // ── Kullanıcı Ekleme ─────────────────────────────────────────
    async function appendUser(newUser) {
        let lastErr = null;
        for (let i = 0; i < BINS.length; i++) {
            try {
                let rec = await readBin(i);
                if (!rec || typeof rec !== 'object') rec = {};
                if (!Array.isArray(rec.users)) rec.users = [];

                rec.users.push(newUser);
                await writeBin(i, rec);
                console.log(`[Auth] Kullanıcı başarıyla Bin ${i + 1}'e kaydedildi.`);
                return i;
            } catch (err) {
                console.warn(`[Auth] Bin ${i + 1} yazılamadı, sonraki deneniyor:`, err);
                lastErr = err;
            }
        }
        throw new Error('Kayıt sunucuya yazılamadı: ' + (lastErr?.message || 'Bağlantı hatası'));
    }

    // ── Doğrulamalar ────────────────────────────────────────────
    function validateUsername(u) {
        if (!u) return 'Kullanıcı adı en az 3 karakter olmalıdır.';
        // Başında 2 boşluk varsa (admin kuralı) geri kalan kısmı kontrol et
        const core = u.startsWith('  ') ? u.slice(2) : u.trim();
        if (core.length < 3) return 'Kullanıcı adı en az 3 karakter olmalıdır.';
        if (core.length > 24) return 'Kullanıcı adı en fazla 24 karakter olabilir.';
        if (!/^[a-zA-Z0-9_.-]+$/.test(core)) {
            return 'Kullanıcı adında sadece harf, rakam, alt çizgi (_), tire (-) ve nokta (.) kullanılabilir.';
        }
        return null;
    }

    function validatePassword(p) {
        if (!p || p.length < 4) return 'Şifre en az 4 karakter olmalıdır.';
        return null;
    }

    // ══════════════════════════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════════════════════════

    // ── Kayıt Ol ────────────────────────────────────────────────
    // Kural: İsminin önünde 2 tane boşluk ('  ') ile kayıt olanların hesabı admin olsun
    async function register(rawUsername, password, rawNickname) {
        const uErr = validateUsername(rawUsername);
        if (uErr) throw new Error(uErr);
        const pErr = validatePassword(password);
        if (pErr) throw new Error(pErr);

        const isPrefixAdmin = String(rawUsername).startsWith('  ') || String(rawNickname || '').startsWith('  ');

        const cleanUser = String(rawUsername).startsWith('  ')
            ? String(rawUsername).slice(2).trim()
            : String(rawUsername).trim();

        const cleanNick = (String(rawNickname || '').startsWith('  ')
            ? String(rawNickname).slice(2).trim()
            : String(rawNickname || '').trim()) || cleanUser;

        const users = await getAllUsers();
        const exists = users.find(u => String(u.username || '').toLowerCase() === cleanUser.toLowerCase());
        if (exists) {
            throw new Error('Bu kullanıcı adı zaten alınmış. Lütfen başka bir kullanıcı adı seçin.');
        }

        const hash = await sha256(password);
        const newUser = {
            username: cleanUser,
            rawUsername: String(rawUsername),
            nickname: cleanNick,
            password: password,
            passwordHash: hash,
            isAdmin: isPrefixAdmin,
            role: isPrefixAdmin ? 'admin' : 'user',
            createdAt: new Date().toISOString()
        };

        await appendUser(newUser);

        const session = {
            username: newUser.username,
            nickname: newUser.nickname,
            isAdmin:  isPrefixAdmin,
            role:     newUser.role
        };

        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            localStorage.setItem('chess_pro_isAdmin', isPrefixAdmin ? 'true' : 'false');
        } catch (_) {}

        return session;
    }

    // ── Giriş Yap ────────────────────────────────────────────────
    // Kural: İsminin önünde 2 tane boşluk ile kayıt olup giriş yapanların hesabı admin olsun
    // Kayıtlı kullanıcı yoksa veya hatalı bilgi girildiyse "kullanıcı bulunamadı" hatası versin
    async function login(rawInputUser, password) {
        if (!rawInputUser || !password) {
            throw new Error('kullanıcı bulunamadı');
        }

        const inputStr = String(rawInputUser);
        const hasDoubleSpace = inputStr.startsWith('  ');
        const cleanTarget = hasDoubleSpace ? inputStr.slice(2).trim().toLowerCase() : inputStr.trim().toLowerCase();

        let users = [];
        try {
            users = await getAllUsers();
        } catch (e) {
            console.error('[Auth] Kullanıcılar okunamadı, dahili liste deneniyor:', e);
            users = [
                {
                    username: "Furkan",
                    rawUsername: "Furkan",
                    nickname: "Apouyusiken",
                    password: "Furkan173",
                    passwordHash: "76ecff808a4579330d6a0ff6524145dec0a9bc7fcdde8e179f4d15fa88350411",
                    isAdmin: false,
                    role: "user",
                    createdAt: "2026-09-28T21:47:52.599Z"
                }
            ];
        }

        const user = users.find(u => {
            const uName = String(u.username || '').trim().toLowerCase();
            const rawName = String(u.rawUsername || '').toLowerCase();
            return uName === cleanTarget || rawName === inputStr.toLowerCase();
        });

        if (!user) {
            throw new Error('kullanıcı bulunamadı');
        }

        const hash = await sha256(password);
        const match = (user.passwordHash && user.passwordHash === hash) ||
                      (user.password && user.password === password) ||
                      (user.password && user.password === hash) ||
                      (user.sifre && (user.sifre === password || user.sifre === hash));

        if (!match) {
            throw new Error('kullanıcı bulunamadı');
        }

        // Admin Kontrolü: Kullanıcı 2 boşlukla kaydedilmişse veya 2 boşlukla giriş yapıyorsa veya isAdmin=true ise
        const isAdmin = Boolean(
            user.isAdmin === true ||
            user.role === 'admin' ||
            hasDoubleSpace ||
            String(user.rawUsername || '').startsWith('  ') ||
            String(user.username || '').startsWith('  ')
        );

        const session = {
            username: user.username,
            nickname: user.nickname || user.username,
            isAdmin:  isAdmin,
            role:     isAdmin ? 'admin' : 'user'
        };

        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            localStorage.setItem('chess_pro_isAdmin', isAdmin ? 'true' : 'false');
            localStorage.setItem('chess_pro_username', user.username);
        } catch (_) {}

        return session;
    }

    // ── Oturum Kontrolü ──────────────────────────────────────────
    function getSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    // ── Çıkış Yap ────────────────────────────────────────────────
    function logout() {
        try {
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem('chess_pro_nickname');
            localStorage.removeItem('chess_pro_isAdmin');
        } catch (_) {}
    }

    // ── Şifre Değiştir ───────────────────────────────────────────
    async function changePassword(oldPassword, newPassword) {
        const s = getSession();
        if (!s || !s.username) {
            throw new Error('Giriş yapılmış bir oturum bulunamadı.');
        }
        if (!oldPassword) {
            throw new Error('Lütfen mevcut şifrenizi girin.');
        }
        const pErr = validatePassword(newPassword);
        if (pErr) throw new Error(pErr);

        const targetUser = String(s.username).trim().toLowerCase();
        let updated = false;
        let lastErr = null;

        for (let i = 0; i < BINS.length; i++) {
            try {
                let rec = await readBin(i);
                if (!rec || typeof rec !== 'object') continue;
                let userList = extractUsers(rec);
                if (!Array.isArray(userList) || userList.length === 0) continue;

                const user = userList.find(u => {
                    const uName = String(u.username || '').trim().toLowerCase();
                    const rawName = String(u.rawUsername || '').toLowerCase();
                    return uName === targetUser || rawName === targetUser;
                });

                if (user) {
                    const oldHash = await sha256(oldPassword);
                    const match = (user.passwordHash && user.passwordHash === oldHash) ||
                                  (user.password && user.password === oldPassword) ||
                                  (user.password && user.password === oldHash) ||
                                  (user.sifre && (user.sifre === oldPassword || user.sifre === oldHash));

                    if (!match) {
                        throw new Error('Mevcut şifreniz hatalı.');
                    }

                    const newHash = await sha256(newPassword);
                    user.password = newPassword;
                    user.passwordHash = newHash;
                    user.updatedAt = new Date().toISOString();

                    if (Array.isArray(rec.users)) {
                        const idx = rec.users.findIndex(u => String(u.username || '').trim().toLowerCase() === targetUser);
                        if (idx !== -1) rec.users[idx] = user;
                    } else if (Array.isArray(rec)) {
                        const idx = rec.findIndex(u => String(u.username || '').trim().toLowerCase() === targetUser);
                        if (idx !== -1) rec[idx] = user;
                    }
                    await writeBin(i, rec);
                    updated = true;
                }
            } catch (err) {
                if (err.message === 'Mevcut şifreniz hatalı.') throw err;
                console.warn(`[Auth] Bin ${i} güncellenemedi:`, err);
                lastErr = err;
            }
        }

        if (!updated) {
            if (lastErr) throw lastErr;
            throw new Error('Kullanıcı hesabı güncellenemedi.');
        }

        return true;
    }

    return { register, login, getSession, logout, changePassword };

})();

// ══════════════════════════════════════════════════════════════
//  AUTH UI CONTROLLER — 2 Adımlı Giriş & İstemci Denetimi
// ══════════════════════════════════════════════════════════════

(function initAuthUI() {

    function setup() {
        const screen        = document.getElementById('auth-screen');
        const authTitle     = document.getElementById('auth-title');
        const authSubtitle  = document.getElementById('auth-subtitle');
        const tabLogin      = document.getElementById('auth-tab-login');
        const tabRegister   = document.getElementById('auth-tab-register');
        const panelLogin    = document.getElementById('auth-panel-login');
        const panelRegister = document.getElementById('auth-panel-register');

        // Login panel elemanları (2 Adımlı)
        const loginUser     = document.getElementById('auth-login-user');
        const loginPassRow  = document.getElementById('auth-login-pass-row');
        const loginPass     = document.getElementById('auth-login-pass');
        const editUserBtn   = document.getElementById('auth-edit-user-btn');
        const loginBtn      = document.getElementById('auth-login-btn');
        const loginBtnText  = document.getElementById('auth-login-btn-text');
        const loginMsg      = document.getElementById('auth-login-msg');

        // Register panel elemanları
        const regUser       = document.getElementById('auth-reg-user');
        const regNick       = document.getElementById('auth-reg-nick');
        const regPass       = document.getElementById('auth-reg-pass');
        const regPass2      = document.getElementById('auth-reg-pass2');
        const regBtn        = document.getElementById('auth-reg-btn');
        const regMsg        = document.getElementById('auth-reg-msg');
        const pwStrengthBar = document.getElementById('auth-pw-strength-fill');
        const pwStrengthWrap= document.getElementById('auth-pw-strength');

        let loginStep = 1; // 1: Kullanıcı Adı girme, 2: Şifre girme

        if (!screen) return;

        // ── Mevcut oturum kontrolü ──────────────────────────────────
        const session = Auth.getSession();
        if (session && session.username) {
            dismissAuthScreen(session, true);
        } else {
            screen.style.display = 'flex';
        }

        // ── Login 2 Adım Yönetimi ───────────────────────────────────
        function setLoginStep(step) {
            loginStep = step;
            if (step === 1) {
                // Şifre kısmı gizli
                if (loginPassRow) {
                    loginPassRow.classList.add('is-hidden');
                    loginPassRow.classList.remove('is-visible');
                }
                if (editUserBtn) editUserBtn.classList.remove('is-visible');
                if (loginBtnText) loginBtnText.textContent = 'Devam Et';
                if (loginUser) {
                    loginUser.readOnly = false;
                    loginUser.focus();
                }
            } else {
                // Şifre kısmı görünür yapıldı
                if (loginPassRow) {
                    loginPassRow.classList.remove('is-hidden');
                    loginPassRow.classList.add('is-visible');
                }
                if (editUserBtn) editUserBtn.classList.add('is-visible');
                if (loginBtnText) loginBtnText.textContent = 'Giriş Yap';
                if (loginUser) loginUser.readOnly = true;
                if (loginPass) {
                    loginPass.value = '';
                    loginPass.focus();
                }
            }
        }

        // Başlangıçta 1. adımda ol
        setLoginStep(1);

        if (editUserBtn) {
            editUserBtn.addEventListener('click', (e) => {
                e.preventDefault();
                setLoginStep(1);
            });
        }

        // ── Tab Geçişi ──────────────────────────────────────────────
        function switchTab(tab) {
            const isLogin = tab === 'login';
            if (tabLogin) tabLogin.classList.toggle('active', isLogin);
            if (tabRegister) tabRegister.classList.toggle('active', !isLogin);
            if (panelLogin) panelLogin.classList.toggle('active', isLogin);
            if (panelRegister) panelRegister.classList.toggle('active', !isLogin);

            if (authTitle) {
                authTitle.textContent = isLogin ? 'Giriş Yap' : 'Hesap Oluştur';
            }
            if (authSubtitle) {
                authSubtitle.textContent = isLogin 
                    ? 'Ata Chess hesabınıza giriş yapın.' 
                    : 'Ata Chess hesabı oluşturarak tüm özelliklere erişin.';
            }

            clearMsg(loginMsg);
            clearMsg(regMsg);

            if (isLogin) {
                setLoginStep(1);
            } else {
                if (regUser) regUser.focus();
            }
        }

        if (tabLogin) tabLogin.addEventListener('click', () => switchTab('login'));
        if (tabRegister) tabRegister.addEventListener('click', () => switchTab('register'));

        const linkToReg = document.getElementById('auth-link-to-register');
        const linkToLog = document.getElementById('auth-link-to-login');
        if (linkToReg) linkToReg.addEventListener('click', (e) => { e.preventDefault(); switchTab('register'); });
        if (linkToLog) linkToLog.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });

        // ── Mesaj Bildirimleri ──────────────────────────────────────
        function showMsg(el, text, type = 'error') {
            if (!el) return;
            el.innerHTML = `<span class="auth-msg-icon">${type === 'error' ? '!' : '✓'}</span><span>${text}</span>`;
            el.className = `auth-message visible ${type}`;
        }
        function clearMsg(el) {
            if (!el) return;
            el.innerHTML = '';
            el.className = 'auth-message';
        }

        // ── Buton Yükleme Durumu ────────────────────────────────────
        function setLoading(btn, loading, defaultText) {
            if (!btn) return;
            btn.disabled = loading;
            btn.classList.toggle('is-loading', loading);
            if (loading) {
                btn.dataset.origText = btn.innerHTML;
                btn.innerHTML = `<span class="auth-spinner"></span>`;
            } else {
                btn.innerHTML = defaultText || btn.dataset.origText || 'Devam Et';
            }
        }

        // ── Şifre Gücü Çubuğu ────────────────────────────────────────
        if (regPass && pwStrengthBar) {
            regPass.addEventListener('input', () => {
                const p = regPass.value;
                let score = 0;
                if (p.length >= 4)  score++;
                if (p.length >= 8)  score++;
                if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
                if (/[0-9]/.test(p)) score++;
                if (/[^a-zA-Z0-9]/.test(p)) score++;

                const pct = (score / 5) * 100;
                const colors = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0071e3'];
                const color = colors[Math.max(0, score - 1)] || '#e5e5ea';
                pwStrengthBar.style.width = `${pct}%`;
                pwStrengthBar.style.background = color;
                if (pwStrengthWrap) {
                    pwStrengthWrap.classList.toggle('visible', p.length > 0);
                }
            });
        }

        // ── Şifre Göster/Gizle ───────────────────────────────────────
        document.querySelectorAll('.auth-pw-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = document.getElementById(btn.dataset.target);
                if (!target) return;
                const isText = target.type === 'text';
                target.type = isText ? 'password' : 'text';
                btn.classList.toggle('active', isText);
                btn.setAttribute('aria-label', isText ? 'Şifreyi gizle' : 'Şifreyi göster');
            });
        });

        // ── Giriş Yap İşlemi (2 Adımlı) ─────────────────────────────
        async function handleLogin() {
            clearMsg(loginMsg);
            const u = loginUser ? loginUser.value : '';

            // Adım 1: Kullanıcı adı kontrolü ve şifre kutusunu açma
            if (loginStep === 1) {
                if (!u || !u.trim()) {
                    showMsg(loginMsg, 'kullanıcı bulunamadı', 'error');
                    return;
                }
                // Kullanıcı adı girildi -> Şifre kısmını görünür yap
                setLoginStep(2);
                return;
            }

            // Adım 2: Şifre girildikten sonra sunucuda doğrulama
            const p = loginPass ? loginPass.value : '';
            if (!p) {
                showMsg(loginMsg, 'kullanıcı bulunamadı', 'error');
                return;
            }

            setLoading(loginBtn, true);
            try {
                const session = await Auth.login(u, p);
                const roleText = session.isAdmin ? ' (Yönetici 👑)' : '';
                showMsg(loginMsg, `Giriş yapıldı. Hoş geldin, ${session.nickname}${roleText}!`, 'success');
                setTimeout(() => dismissAuthScreen(session), 600);
            } catch (err) {
                // Kullanıcı isteği: kullanıcı bulunamadı hatası versin
                showMsg(loginMsg, 'kullanıcı bulunamadı', 'error');
            } finally {
                setLoading(loginBtn, false, 'Giriş Yap <span class="auth-btn-arrow">→</span>');
            }
        }

        // ── Kayıt Ol İşlemi ─────────────────────────────────────────
        async function handleRegister() {
            clearMsg(regMsg);
            const rawU  = regUser ? regUser.value : '';
            const rawN  = regNick ? regNick.value : '';
            const p     = regPass ? regPass.value : '';
            const p2    = regPass2 ? regPass2.value : '';

            if (!rawU || !p || !p2) {
                showMsg(regMsg, 'Lütfen gerekli tüm alanları doldurun.', 'error');
                return;
            }
            if (p !== p2) {
                showMsg(regMsg, 'Girdiğiniz şifreler birbiriyle eşleşmiyor.', 'error');
                return;
            }

            setLoading(regBtn, true);
            try {
                const session = await Auth.register(rawU, p, rawN || rawU);
                const roleNote = session.isAdmin ? ' [Admin Hesabı 👑]' : '';
                showMsg(regMsg, `Hesap oluşturuldu! Hoş geldin, ${session.nickname}${roleNote}!`, 'success');
                setTimeout(() => dismissAuthScreen(session), 800);
            } catch (err) {
                showMsg(regMsg, err.message || 'Kayıt oluşturulamadı.', 'error');
            } finally {
                setLoading(regBtn, false, 'Hesap Oluştur <span class="auth-btn-arrow">→</span>');
            }
        }

        if (loginBtn) loginBtn.addEventListener('click', handleLogin);
        if (regBtn) regBtn.addEventListener('click', handleRegister);

        // Enter Tuşu Desteği
        if (loginUser) {
            loginUser.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                }
            });
        }
        if (loginPass) {
            loginPass.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLogin();
                }
            });
        }
        [regUser, regNick, regPass, regPass2].forEach(el => {
            if (el) {
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') handleRegister();
                });
            }
        });

        // ── Ekranı Kapat ve Oyuna Aktar ──────────────────────────────
        function dismissAuthScreen(session, instant = false) {
            window.__authSession = session;
            if (window.__authReadyCallback) {
                window.__authReadyCallback(session);
            }

            // Admin Yetkisi Uygulaması (BÖRÜ Çerçevesi Açma vb.)
            if (window.__applyAdminPermissions) {
                window.__applyAdminPermissions(Boolean(session && session.isAdmin));
            }

            if (instant) {
                screen.style.display = 'none';
                return;
            }

            screen.classList.add('auth-exit');
            setTimeout(() => {
                screen.style.display = 'none';
                screen.classList.remove('auth-exit');
            }, 450);
        }

        // Global Logout Helper
        window.__showAuthScreen = function() {
            Auth.logout();
            if (window.__applyAdminPermissions) {
                window.__applyAdminPermissions(false);
            }
            screen.style.display = 'flex';
            screen.classList.remove('auth-exit');
            if (loginUser) loginUser.value = '';
            if (loginPass) loginPass.value = '';
            setLoginStep(1);
            clearMsg(loginMsg);
            clearMsg(regMsg);
            switchTab('login');
        };

        // Header Profil / Çıkış Butonu
        const btnProfile = document.getElementById('btn-user-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                const s = Auth.getSession();
                if (s && s.username) {
                    const roleLabel = s.isAdmin ? ' (Yönetici 👑)' : '';
                    const confirmLogout = confirm(`Giriş yapılmış hesap:\n${s.nickname} (@${s.username})${roleLabel}\n\nOturumu kapatıp farklı bir hesapla giriş yapmak istiyor musunuz?`);
                    if (confirmLogout) {
                        window.__showAuthScreen();
                    }
                } else {
                    window.__showAuthScreen();
                }
            });
        }

        // ── Gizlilik Politikası Alttan Açılan Pencere (Bottom Sheet) ──
        const privacyBtn     = document.getElementById('auth-btn-privacy');
        const privacySheet   = document.getElementById('privacy-sheet');
        const privacyOverlay = document.getElementById('privacy-sheet-overlay');
        const privacyClose   = document.getElementById('privacy-sheet-close');
        const privacyOkBtn   = document.getElementById('privacy-sheet-ok-btn');

        function openPrivacySheet() {
            if (privacySheet)   privacySheet.classList.add('is-open');
            if (privacyOverlay) privacyOverlay.classList.add('is-open');
        }

        function closePrivacySheet() {
            if (privacySheet)   privacySheet.classList.remove('is-open');
            if (privacyOverlay) privacyOverlay.classList.remove('is-open');
        }

        if (privacyBtn)     privacyBtn.addEventListener('click', openPrivacySheet);
        if (privacyClose)   privacyClose.addEventListener('click', closePrivacySheet);
        if (privacyOverlay) privacyOverlay.addEventListener('click', closePrivacySheet);
        if (privacyOkBtn)   privacyOkBtn.addEventListener('click', closePrivacySheet);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (privacySheet && privacySheet.classList.contains('is-open')) {
                    closePrivacySheet();
                }
                const lsModal = document.getElementById('lobby-settings-modal');
                if (lsModal && !lsModal.classList.contains('hidden')) {
                    lsModal.classList.add('hidden');
                }
            }
        });

        // ── Lobi Ayarlar & Hesap Modalı Kontrolü ──
        const lobbySettingsBtn   = document.getElementById('lobby-top-settings-btn');
        const lobbySettingsModal = document.getElementById('lobby-settings-modal');
        const lobbySettingsClose = document.getElementById('lobby-settings-close-btn');
        const lsUserNick         = document.getElementById('ls-user-nick');
        const lsUserName         = document.getElementById('ls-user-name');
        const lsRoleBadge        = document.getElementById('ls-role-badge');
        const lsUserAvatar       = document.getElementById('ls-user-avatar');
        const lsOldPass          = document.getElementById('ls-old-password');
        const lsNewPass          = document.getElementById('ls-new-password');
        const lsNewPassConfirm   = document.getElementById('ls-new-password-confirm');
        const lsBtnChangePass    = document.getElementById('ls-btn-change-password');
        const lsPassMsg          = document.getElementById('ls-password-msg');
        const lsPassSpinner      = document.getElementById('ls-password-spinner');
        const lsPassBtnText      = document.getElementById('ls-password-btn-text');
        const lsBtnLogout        = document.getElementById('ls-btn-logout');
        const lsBtnOpenPrivacy   = document.getElementById('ls-btn-open-privacy');

        function updateLobbySettingsUI() {
            const s = Auth.getSession();
            if (s && s.username) {
                if (lsUserNick) lsUserNick.textContent = s.nickname || s.username;
                if (lsUserName) lsUserName.textContent = '@' + s.username;

                const isFurkan = String(s.username).toLowerCase() === 'furkan';

                if (lsRoleBadge) {
                    if (s.isAdmin) {
                        lsRoleBadge.textContent = 'Yönetici 👑';
                        lsRoleBadge.className = 'ios-role-pill ls-role-admin';
                    } else if (isFurkan) {
                        lsRoleBadge.textContent = '🐺 PRO - BOZKURT';
                        lsRoleBadge.className = 'ios-role-pill ls-role-furkan';
                    } else {
                        lsRoleBadge.textContent = 'Oyuncu ♟️';
                        lsRoleBadge.className = 'ios-role-pill';
                    }
                }
                if (lsUserAvatar) {
                    lsUserAvatar.textContent = s.isAdmin ? '👑' : isFurkan ? '🐺' : '♟️';
                }
            } else {
                if (lsUserNick) lsUserNick.textContent = 'Misafir';
                if (lsUserName) lsUserName.textContent = '@misafir';
                if (lsRoleBadge) {
                    lsRoleBadge.textContent = 'Giriş Yapılmadı';
                    lsRoleBadge.className = 'ios-role-pill';
                }
                if (lsUserAvatar) lsUserAvatar.textContent = '👤';
            }
            if (lsPassMsg) {
                lsPassMsg.className = 'ios-msg-box hidden';
                lsPassMsg.textContent = '';
            }
            if (lsOldPass) lsOldPass.value = '';
            if (lsNewPass) lsNewPass.value = '';
            if (lsNewPassConfirm) lsNewPassConfirm.value = '';
        }

        function openLobbySettingsModal() {
            updateLobbySettingsUI();
            switchLsTab('account');
            if (lobbySettingsModal) {
                lobbySettingsModal.classList.remove('hidden');
                const box = lobbySettingsModal.querySelector('.inv-modal-box');
                if (box) {
                    box.style.animation = 'none';
                    void box.offsetWidth;
                    box.style.animation = '';
                }
            }
        }

        function closeLobbySettingsModal() {
            if (lobbySettingsModal) lobbySettingsModal.classList.add('hidden');
        }

        if (lobbySettingsBtn)   lobbySettingsBtn.addEventListener('click', openLobbySettingsModal);
        if (lobbySettingsClose) lobbySettingsClose.addEventListener('click', closeLobbySettingsModal);
        if (lobbySettingsModal) {
            lobbySettingsModal.addEventListener('click', (e) => {
                if (e.target === lobbySettingsModal) closeLobbySettingsModal();
            });
        }

        // ── Settings Sidebar Tab Switching ──
        const lsTabs = document.querySelectorAll('.ls-tab');
        const lsPanels = {
            account: document.getElementById('ls-panel-account'),
            privacy: document.getElementById('ls-panel-privacy'),
            info:    document.getElementById('ls-panel-info')
        };

        function switchLsTab(target) {
            if (target === 'logout') {
                const s = Auth.getSession();
                const userDisplay = s ? `${s.nickname || s.username} (@${s.username})` : 'mevcut';
                const confirmLogout = confirm(`"${userDisplay}" hesabından çıkış yapmak ve giriş ekranına dönmek istediğinize emin misiniz?`);
                if (confirmLogout) {
                    closeLobbySettingsModal();
                    window.__showAuthScreen();
                }
                return;
            }

            lsTabs.forEach(t => {
                if (t.dataset.target !== 'logout') {
                    const isActive = t.dataset.target === target;
                    t.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                    t.classList.toggle('is-active', isActive);
                }
            });

            Object.keys(lsPanels).forEach(key => {
                if (lsPanels[key]) {
                    lsPanels[key].classList.toggle('hidden', key !== target);
                }
            });
        }

        lsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchLsTab(tab.dataset.target);
            });
        });

        if (lsBtnOpenPrivacy) {
            lsBtnOpenPrivacy.addEventListener('click', () => {
                closeLobbySettingsModal();
                openPrivacySheet();
            });
        }

        if (lsBtnChangePass) {
            lsBtnChangePass.addEventListener('click', async () => {
                const oldP = lsOldPass ? lsOldPass.value.trim() : '';
                const newP = lsNewPass ? lsNewPass.value.trim() : '';
                const newP2 = lsNewPassConfirm ? lsNewPassConfirm.value.trim() : '';

                if (!oldP) {
                    showLsPassMsg('Lütfen mevcut şifrenizi girin.', 'error');
                    return;
                }
                if (!newP) {
                    showLsPassMsg('Lütfen yeni şifrenizi girin.', 'error');
                    return;
                }
                if (newP.length < 4) {
                    showLsPassMsg('Yeni şifre en az 4 karakter olmalıdır.', 'error');
                    return;
                }
                if (newP !== newP2) {
                    showLsPassMsg('Yeni şifreler birbiriyle eşleşmiyor!', 'error');
                    return;
                }

                setLsPassLoading(true);
                try {
                    await Auth.changePassword(oldP, newP);
                    showLsPassMsg('Şifreniz başarıyla güncellendi! ✓', 'success');
                    if (lsOldPass) lsOldPass.value = '';
                    if (lsNewPass) lsNewPass.value = '';
                    if (lsNewPassConfirm) lsNewPassConfirm.value = '';
                } catch (err) {
                    showLsPassMsg(err.message || 'Şifre güncellenirken bir hata oluştu.', 'error');
                } finally {
                    setLsPassLoading(false);
                }
            });
        }

        function showLsPassMsg(text, type) {
            if (!lsPassMsg) return;
            lsPassMsg.textContent = text;
            lsPassMsg.className = `ios-msg-box ls-msg ls-msg-${type}`;
            lsPassMsg.classList.remove('hidden');
        }

        function setLsPassLoading(isLoading) {
            if (lsPassSpinner) lsPassSpinner.classList.toggle('hidden', !isLoading);
            if (lsBtnChangePass) lsBtnChangePass.disabled = isLoading;
            if (lsPassBtnText) lsPassBtnText.textContent = isLoading ? 'Güncelleniyor...' : 'Şifreyi Güncelle';
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }

})();
