-- ============================================================
-- 🌳 Gia Phả Điện Tử — Database Setup
-- ============================================================
-- Chạy file này trong: Supabase Dashboard → SQL Editor
-- File này tạo toàn bộ cấu trúc database + dữ liệu mẫu demo
-- ============================================================


-- ╔══════════════════════════════════════════════════════════╗
-- ║  1. CORE TABLES: people + families                      ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS people (
    handle TEXT PRIMARY KEY,
    gramps_id TEXT,
    gender INT NOT NULL DEFAULT 1,           -- 1=Nam, 2=Nữ
    display_name TEXT NOT NULL,
    surname TEXT,
    first_name TEXT,
    generation INT DEFAULT 1,
    chi INT,
    birth_year INT,
    birth_date TEXT,
    birth_place TEXT,
    death_year INT,
    death_date TEXT,
    death_place TEXT,
    is_living BOOLEAN DEFAULT true,
    is_privacy_filtered BOOLEAN DEFAULT false,
    is_patrilineal BOOLEAN DEFAULT true,     -- true=chính tộc, false=ngoại tộc
    families TEXT[] DEFAULT '{}',            -- family handles where this person is parent
    parent_families TEXT[] DEFAULT '{}',     -- family handles where this person is child
    phone TEXT,
    email TEXT,
    zalo TEXT,
    facebook TEXT,
    current_address TEXT,
    hometown TEXT,
    occupation TEXT,
    company TEXT,
    education TEXT,
    nick_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS families (
    handle TEXT PRIMARY KEY,
    father_handle TEXT,
    mother_handle TEXT,
    children TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_people_generation ON people (generation);
CREATE INDEX IF NOT EXISTS idx_people_surname ON people (surname);
CREATE INDEX IF NOT EXISTS idx_families_father ON families (father_handle);
CREATE INDEX IF NOT EXISTS idx_families_mother ON families (mother_handle);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER people_updated_at BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  2. AUTH: profiles + auto-create trigger                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    person_handle TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
-- ⚠️ ĐỔI EMAIL ADMIN: thay 'your-admin@example.com' bằng email admin thật
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_email TEXT;
BEGIN
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
    IF user_email != '' THEN
        INSERT INTO profiles (id, email, role)
        VALUES (
            NEW.id,
            user_email,
            CASE WHEN user_email = 'your-admin@example.com' THEN 'admin' ELSE 'viewer' END
        )
        ON CONFLICT (email) DO UPDATE SET id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ╔══════════════════════════════════════════════════════════╗
-- ║  3. CONTRIBUTIONS (đề xuất chỉnh sửa)                  ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email TEXT,
    person_handle TEXT NOT NULL,
    person_name TEXT,
    field_name TEXT NOT NULL,
    field_label TEXT,
    old_value TEXT,
    new_value TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_person ON contributions(person_handle);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  4. COMMENTS (bình luận)                                ║
-- ╚══════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_email TEXT,
    author_name TEXT,
    person_handle TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_person ON comments(person_handle);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  5. ROW LEVEL SECURITY (RLS)                            ║
-- ╚══════════════════════════════════════════════════════════╝

-- People & Families: public read, authenticated write, admin delete
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read people" ON people FOR SELECT USING (true);
CREATE POLICY "anyone can read families" ON families FOR SELECT USING (true);
CREATE POLICY "authenticated can update people" ON people
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated can insert people" ON people
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "admin can delete people" ON people
    FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "authenticated can update families" ON families
    FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated can insert families" ON families
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "admin can delete families" ON families
    FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Profiles: public read, update own or admin
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users or admin can update profile" ON profiles
    FOR UPDATE USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Contributions: public read, user insert own, admin update
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read contributions" ON contributions FOR SELECT USING (true);
CREATE POLICY "users can insert contributions" ON contributions FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "admin can update contributions" ON contributions
    FOR UPDATE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Comments: public read, user insert own, owner/admin delete
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "users can insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "owner or admin can delete comments" ON comments
    FOR DELETE USING (
        author_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Constraints
ALTER TABLE comments ADD CONSTRAINT comments_content_length CHECK (char_length(content) BETWEEN 1 AND 2000);
ALTER TABLE contributions ADD CONSTRAINT contributions_value_length CHECK (char_length(new_value) <= 5000);


-- ╔══════════════════════════════════════════════════════════╗
-- ║  6. DỮ LIỆU MẪU DEMO (xóa phần này nếu dùng dữ liệu thật)║
-- ╚══════════════════════════════════════════════════════════╝

-- Dòng họ mẫu: Họ Nguyễn Văn — 4 thế hệ, 15 thành viên
-- Cấu trúc:
--   Đời 1: Nguyễn Văn An (tổ tiên)
--   Đời 2: Bình, Cường, Dũng (3 con trai)
--   Đời 3: Bình → Hải, Hùng | Cường → Khoa, Khánh | Dũng → Long
--   Đời 4: Hải → Minh, Nam | Khoa → Phúc

-- People
INSERT INTO people (handle, display_name, gender, generation, birth_year, death_year, is_living, is_patrilineal, families, parent_families) VALUES
-- Đời 1
('P001', 'Nguyễn Văn An',    1, 1, 1920, 1995, false, true, '{"F001"}', '{}'),
-- Đời 2
('P002', 'Nguyễn Văn Bình',  1, 2, 1945, NULL, true,  true, '{"F002"}', '{"F001"}'),
('P003', 'Nguyễn Văn Cường', 1, 2, 1948, NULL, true,  true, '{"F003"}', '{"F001"}'),
('P004', 'Nguyễn Văn Dũng',  1, 2, 1951, 2020, false, true, '{"F004"}', '{"F001"}'),
-- Đời 3
('P005', 'Nguyễn Văn Hải',   1, 3, 1970, NULL, true,  true, '{"F005"}', '{"F002"}'),
('P006', 'Nguyễn Văn Hùng',  1, 3, 1973, NULL, true,  true, '{}',       '{"F002"}'),
('P007', 'Nguyễn Văn Khoa',  1, 3, 1975, NULL, true,  true, '{"F006"}', '{"F003"}'),
('P008', 'Nguyễn Văn Khánh', 1, 3, 1978, NULL, true,  true, '{}',       '{"F003"}'),
('P009', 'Nguyễn Văn Long',  1, 3, 1980, NULL, true,  true, '{}',       '{"F004"}'),
-- Đời 4
('P010', 'Nguyễn Văn Minh',  1, 4, 1995, NULL, true,  true, '{}',       '{"F005"}'),
('P011', 'Nguyễn Văn Nam',   1, 4, 1998, NULL, true,  true, '{}',       '{"F005"}'),
('P012', 'Nguyễn Văn Phúc',  1, 4, 2000, NULL, true,  true, '{}',       '{"F006"}'),
-- Vợ (ngoại tộc)
('P013', 'Trần Thị Lan',     2, 1, 1925, 2000, false, false, '{}', '{}'),
('P014', 'Lê Thị Mai',       2, 2, 1948, NULL, true,  false, '{}', '{}'),
('P015', 'Phạm Thị Hoa',     2, 3, 1972, NULL, true,  false, '{}', '{}')
ON CONFLICT (handle) DO NOTHING;

-- Families
INSERT INTO families (handle, father_handle, mother_handle, children) VALUES
('F001', 'P001', 'P013', '{"P002","P003","P004"}'),
('F002', 'P002', 'P014', '{"P005","P006"}'),
('F003', 'P003', NULL,   '{"P007","P008"}'),
('F004', 'P004', NULL,   '{"P009"}'),
('F005', 'P005', 'P015', '{"P010","P011"}'),
('F006', 'P007', NULL,   '{"P012"}')
ON CONFLICT (handle) DO NOTHING;


-- ============================================================
SELECT '✅ Database setup complete! Demo data loaded.' AS status;
-- ============================================================
