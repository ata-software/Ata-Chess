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
            console.error('[Auth] Kullanıcılar okunamadı:', e);
            throw new Error('kullanıcı bulunamadı');
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

    return { register, login, getSession, logout };

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
            if (e.key === 'Escape' && privacySheet && privacySheet.classList.contains('is-open')) {
                closePrivacySheet();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        setup();
    }

})();
