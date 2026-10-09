import { WallPost, UserAccount } from '../types/wall';
import { SAMPLE_HADITHS } from '../data/sampleHadiths';

export const CURRENT_DEFAULT_USER: UserAccount = {
  user_id: 'user_dragon_101',
  email: 'ferozansarlk@gmail.com',
  display_name: 'Feroz Ansar',
  profile_pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  preferred_language: 'en',
  created_at: '2026-10-09T08:00:00Z',
  badge: 'Lead Authentication Officer'
};

export const INITIAL_WALL_POSTS: WallPost[] = [
  {
    post_id: 'post_wall_001',
    search_id: 'search_intentions_01',
    author_id: 'user_dragon_101',
    author_name: 'Feroz Ansar',
    author_email: 'ferozansarlk@gmail.com',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Lead Authentication Officer',
    query_text: 'Actions are by intentions, and every person will have only what they intended...',
    canonical_arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى',
    isnad_preview: "Bukhari -> Humaydi -> Sufyan -> Yahya ibn Sa'id -> Muhammad ibn Ibrahim -> 'Alqamah -> 'Umar ibn al-Khattab",
    purity_score: 100.0,
    final_status: "Muttafaq 'Alayh (Sahih Bukhari & Muslim)",
    consensus_summary: "Universally acknowledged as a cornerstone of Islamic theology and jurisprudence. Absolute Gharib at its inception, transforming into Mashhur across the Islamic world.",
    is_public: true,
    likes_count: 58,
    comments_count: 3,
    user_has_liked: true,
    tags: ["Muttafaq 'Alayh", "Kutub al-Sittah", "Foundational"],
    created_at: '2026-10-09T04:30:00Z',
    full_analysis_payload: SAMPLE_HADITHS[1].defaultData,
    comments: [
      {
        comment_id: 'comm_001',
        post_id: 'post_wall_001',
        author_id: 'scholar_tariq_202',
        author_name: 'Dr. Tariq al-Mansoor',
        author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        author_role: 'Takhrij & Source Detective',
        text: 'The text exhibits identical pristine wording across Bukhari Hadith #1, Muslim Hadith #1907, and Abu Dawud Hadith #2201.',
        language: 'en',
        created_at: '2026-10-09T04:45:00Z',
        likes: 14
      },
      {
        comment_id: 'comm_002',
        post_id: 'post_wall_001',
        author_id: 'user_ta_303',
        author_name: 'முஹம்மத் அஸ்ஹர் (M. Azhar)',
        author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        author_role: 'Madrasah Researcher',
        text: 'எண்ணங்களை அடிப்படையாகக் கொண்ட இந்த அடிப்படை ஹதீஸ் இஸ்லாமிய மார்க்கத்தின் மூன்றில் ஒரு பகுதியாக இமாம் ஷாஃபிஈ (ரஹ்) அவர்களால் வர்ணிக்கப்பட்டுள்ளது.',
        language: 'ta',
        created_at: '2026-10-09T05:00:00Z',
        likes: 9
      },
      {
        comment_id: 'comm_003',
        post_id: 'post_wall_001',
        author_id: 'user_si_404',
        author_name: 'දිනූක් අහමඩ් (D. Ahmed)',
        author_avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80',
        author_role: 'Islamic Jurisprudence Scholar',
        text: 'චේතනාව මත ක්‍රියාවන් තීරණය වන මෙම මූලික නබි වදන ඉස්ලාමීය නීති ශාස්ත්‍රයේ අත්තිවාරමයි. සියලුම ප්‍රධාන හදීස් ග්‍රන්ථ වල සත්‍යාපනය කර ඇත.',
        language: 'si',
        created_at: '2026-10-09T05:15:00Z',
        likes: 7
      }
    ]
  },
  {
    post_id: 'post_wall_002',
    search_id: 'search_china_02',
    author_id: 'user_dragon_101',
    author_name: 'Feroz Ansar',
    author_email: 'ferozansarlk@gmail.com',
    author_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    author_role: 'Lead Authentication Officer',
    query_text: 'Seek knowledge even unto China, for seeking knowledge is an obligation upon every Muslim...',
    canonical_arabic: 'اُطْلُبُوا العِلْمَ وَلَوْ بِالصِّينِ فَإِنَّ طَلَبَ العِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ',
    isnad_preview: "Abu 'Atikah Tarif ibn Sulayman -> Anas ibn Malik -> The Prophet (ﷺ)",
    purity_score: 11.2,
    final_status: "Mawdu' (Fabricated Addition) / Da'if Jiddan",
    consensus_summary: "The addition 'even unto China' is recognized as fabricated by Ibn al-Jawzi, Al-Dhahabi, and modern scholars, transmitting solely through abandoned narrators (Matruk).",
    is_public: true,
    likes_count: 36,
    comments_count: 2,
    user_has_liked: false,
    tags: ["Mawdu'", "Critical Ilal", "Warning Alert"],
    created_at: '2026-10-09T03:10:00Z',
    full_analysis_payload: SAMPLE_HADITHS[2].defaultData,
    comments: [
      {
        comment_id: 'comm_004',
        post_id: 'post_wall_002',
        author_id: 'scholar_imran_203',
        author_name: 'Sheikh Imran al-Hasani',
        author_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
        author_role: 'Character Judge & Rijal Critic',
        text: 'Abu Atikah Tarif ibn Sulayman is categorized as Matruk (abandoned) by Imam al-Bukhari and accused of forging hadiths upon Anas ibn Malik.',
        language: 'en',
        created_at: '2026-10-09T03:30:00Z',
        likes: 18
      },
      {
        comment_id: 'comm_005',
        post_id: 'post_wall_002',
        author_id: 'user_ta_303',
        author_name: 'முஹம்மத் அஸ்ஹர் (M. Azhar)',
        author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        author_role: 'Madrasah Researcher',
        text: '\"சீனா சென்றேனும் கல்வி கற்க\" என்ற வாசகம் பலவீனமான மற்றும் இட்டுக்கட்டப்பட்ட அறிவிப்பாகும். எனினும் கல்வி கற்பது கடமை என்ற பொது வாசகம் ஹசன் தரத்தில் உறுதிப்படுத்தப்பட்டுள்ளது.',
        language: 'ta',
        created_at: '2026-10-09T03:45:00Z',
        likes: 11
      }
    ]
  },
  {
    post_id: 'post_wall_003',
    search_id: 'search_saturday_03',
    author_id: 'scholar_layla_204',
    author_name: 'Dr. Layla al-Qasimi',
    author_email: 'layla@primedragon.com',
    author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    author_role: 'Senior Transmission Specialist',
    query_text: 'Do not fast on Saturdays except for what has been made obligatory for you...',
    canonical_arabic: 'لا تَصُومُوا يَوْمَ السَّبْتِ إِلاَّ فِيمَا افْتُرِضَ عَلَيْكُمْ',
    isnad_preview: "Qutaybah -> Yahya ibn Hamza -> Thawran -> Khalid ibn Ma'dan -> 'Abdullah ibn Busr -> Al-Samma'",
    purity_score: 54.5,
    final_status: "Shadh (Irregular) / Mudtarib according to Imam Malik & Abu Dawud",
    consensus_summary: "Severe jurisprudential discord. Graded Sahih by Al-Albani and Al-Tirmidhi, yet rejected as Shadh and conflicting with Muttafaq fasting traditions by Imam Malik and Ahmad.",
    is_public: true,
    likes_count: 24,
    comments_count: 1,
    user_has_liked: false,
    tags: ["Fiqh Disputed", "Shadh", "Idtirab in Chain"],
    created_at: '2026-10-09T02:00:00Z',
    full_analysis_payload: SAMPLE_HADITHS[0].defaultData,
    comments: [
      {
        comment_id: 'comm_006',
        post_id: 'post_wall_003',
        author_id: 'scholar_zainab_205',
        author_name: 'Dr. Zainab al-Mubarak',
        author_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        author_role: 'Shawahid & Defect Scanner',
        text: 'The primary conflict is with Sahih Bukhari where the Prophet permitted Juwayriyah to fast on Friday and asked if she intended to fast Saturday.',
        language: 'en',
        created_at: '2026-10-09T02:30:00Z',
        likes: 12
      }
    ]
  }
];
