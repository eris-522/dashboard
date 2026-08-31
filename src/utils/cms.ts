import { supabase } from "./supabase";
import { logAuditAction } from "./auditLogger";

export interface HeroCMS {
  tagline: string;
  title: string;
  titleItalic: string;
  subtitle: string;
  backgroundImage: string;
  primaryBtnText: string;
  primaryBtnLink: string;
  secondaryBtnText: string;
  secondaryBtnLink: string;
}

export interface AnnouncementCMS {
  enabled: boolean;
  message: string;
  linkText: string;
  linkUrl: string;
  type: "info" | "promo" | "warning";
}

export interface PillarItem {
  title: string;
  description: string;
  icon: string;
}

export interface AboutCMS {
  headerSubtitle: string;
  headerTitle: string;
  headerTitleItalic: string;
  storyTagline: string;
  storyHeadline: string;
  storyParagraph1: string;
  storyParagraph2: string;
  storyImage: string;
  valuesSubtitle: string;
  valuesTitle: string;
  valuesTitleItalic: string;
  pillars: PillarItem[];
  ctaSubtitle: string;
  ctaTitle: string;
  ctaTitleItalic: string;
  ctaTitleEnd: string;
  ctaBtnText: string;
  ctaBtnLink: string;
}

export interface WhyUsHighlight {
  number: string;
  title: string;
  description: string;
}

export interface ContactCMS {
  headerSubtitle: string;
  headerTitle: string;
  headerTitleItalic: string;
  phone: string;
  email: string;
  address: string;
  officeHours: string;
  mapEmbedUrl: string;
  locationNote: string;
  facebookUrl: string;
  instagramUrl: string;
  messengerUrl: string;
  whyUsSubtitle: string;
  whyUsTitle: string;
  whyUsTitleItalic: string;
  whyUsHighlights: WhyUsHighlight[];
  whyUsImage1: string;
  whyUsImage2: string;
}

export interface ProcessStep {
  number: string;
  title: string;
  text: string;
}

export interface ProcessCMS {
  subtitle: string;
  steps: ProcessStep[];
}

export interface TestimonialItem {
  id: string;
  author: string;
  role: string;
  quote: string;
  rating: number;
  featured: boolean;
  active: boolean;
}

export interface TestimonialsCMS {
  subtitle: string;
  items: TestimonialItem[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  active: boolean;
}

export interface FAQsCMS {
  subtitle: string;
  items: FAQItem[];
}

export interface FooterLink {
  name: string;
  url: string;
}

export interface FooterCMS {
  brandName: string;
  copyrightText: string;
  quickLinks: FooterLink[];
}

export interface FullCMSData {
  hero: HeroCMS;
  announcement: AnnouncementCMS;
  about: AboutCMS;
  contact: ContactCMS;
  process: ProcessCMS;
  testimonials: TestimonialsCMS;
  faqs: FAQsCMS;
  footer: FooterCMS;
}

export const DEFAULT_CMS_DATA: FullCMSData = {
  hero: {
    tagline: "Exquisite Culinary Experiences",
    title: "Affordable Elegance,",
    titleItalic: "Unforgettable Events",
    subtitle: "Available for weddings, corporate galas, and private celebrations across the region.",
    backgroundImage: "https://images.unsplash.com/photo-1555244162-803834f70033?auto=format&fit=crop&q=80&w=2000",
    primaryBtnText: "Inquire Now",
    primaryBtnLink: "/booking",
    secondaryBtnText: "View Menu",
    secondaryBtnLink: "/menu",
  },
  announcement: {
    enabled: false,
    message: "Now accepting catering bookings for the upcoming holiday season! Reserve early for priority dates.",
    linkText: "Book Now",
    linkUrl: "/booking",
    type: "promo",
  },
  about: {
    headerSubtitle: "Behind the Craft",
    headerTitle: "Our",
    headerTitleItalic: "Story",
    storyTagline: "A Culinary Legacy",
    storyHeadline: "Founded on the belief that fine dining should be an accessible experience for all of life's most meaningful milestones.",
    storyParagraph1: "Roxan Policarpio Events & Catering began as a small passion project, fueled by a deep love for Filipino hospitality and global culinary techniques. Over the years, we have evolved into a full-service catering brand known for our meticulous attention to detail and artistic presentation.",
    storyParagraph2: "Our journey has been defined by the smiles of thousands of guests and the success of countless events—from intimate garden weddings and milestone birthdays to grand corporate galas for hundreds of attendees.",
    storyImage: "https://scontent.fmnl17-3.fna.fbcdn.net/v/t1.15752-9/696223294_1463671008399082_3075120905317355661_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=9f807c&_nc_eui2=AeF8Y1R0NyhMvp8gl9ixD8IuMmuqx43po3Uya6rHjemjdUfxja92Q5vtTvTw-_J2pPpUL1cCao3gCtVjfkVj659e&_nc_ohc=ODlXDTe3ta8Q7kNvwFsx7uN&_nc_oc=AdqPZ2cRRNZKL2quPxdm2IiL8WaaseY9oPAZYYlr0TT5LuL8pGLPt2T5ztAckwqv180&_nc_zt=23&_nc_ht=scontent.fmnl17-3.fna&_nc_ss=7b2a8&oh=03_Q7cD5QFjPgKrvwkRZPYDKGi3NdV5QH2732T_Ab67mk1COEjLMg&oe=6A2A1AF5",
    valuesSubtitle: "Our Foundations",
    valuesTitle: "The Pillars of",
    valuesTitleItalic: "Excellence",
    pillars: [
      {
        title: "Quality First",
        description: "We use only the freshest, premium ingredients, turning every dish into a gastronomic masterpiece.",
        icon: "Sparkles",
      },
      {
        title: "Personalized Service",
        description: "Every event is unique. Our team works closely with you to tailor every detail to your specific vision.",
        icon: "Heart",
      },
      {
        title: "Affordable Premium",
        description: "Experience luxury without the compromise. We deliver high-end service at competitive, transparent price points.",
        icon: "Award",
      },
    ],
    ctaSubtitle: "Let's Create Magic",
    ctaTitle: "Ready to",
    ctaTitleItalic: "Elevate",
    ctaTitleEnd: "Your Celebration?",
    ctaBtnText: "Book Your Event Now",
    ctaBtnLink: "/booking",
  },
  contact: {
    headerSubtitle: "Connect With Us",
    headerTitle: "Get In",
    headerTitleItalic: "Touch",
    phone: "+63 921 469 7142",
    email: "rpcatering@gmail.com",
    address: "Javier Compound, L. Wood St., Dolores, Taytay, Rizal",
    officeHours: "Mon - Sat: 9:00 AM - 6:00 PM",
    mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4163.146547807375!2d121.13233027542846!3d14.57230958591067!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c74983e4457f%3A0xa8fd45edcc38ed17!2sRoxan%20Policarpio%20Events%20and%20Catering!5e1!3m2!1sen!2sph!4v1776733590376!5m2!1sen!2sph",
    locationNote: "Serving premium events across Rizal and Metro Manila.",
    facebookUrl: "https://facebook.com",
    instagramUrl: "https://instagram.com",
    messengerUrl: "https://messenger.com",
    whyUsSubtitle: "Why Us",
    whyUsTitle: "Crafting Memories",
    whyUsTitleItalic: "Beyond the Plate",
    whyUsHighlights: [
      {
        number: "01",
        title: "Artistic Presentation",
        description: "We believe food should please the eye as much as the palate.",
      },
      {
        number: "02",
        title: "Meticulous Planning",
        description: "Every logistical detail is handled with surgical precision.",
      },
      {
        number: "03",
        title: "Seamless Execution",
        description: "Our waitstaff is trained in the fine art of subtle, attentive service.",
      },
    ],
    whyUsImage1: "https://images.unsplash.com/photo-1516062423079-7ca13cdc7f5a?auto=format&fit=crop&q=80&w=600",
    whyUsImage2: "https://images.unsplash.com/photo-1533143048019-301bd1fcc077?auto=format&fit=crop&q=80&w=600",
  },
  process: {
    subtitle: "The Process",
    steps: [
      {
        number: "01",
        title: "Choose your package",
        text: "Select from our range of budget-friendly, premium catering collections designed for any occasion.",
      },
      {
        number: "02",
        title: "Customize your package",
        text: "Personalize your menu and services to align with your taste, dietary needs, and event theme.",
      },
      {
        number: "03",
        title: "Confirm booking",
        text: "Finalize your reservation and relax while we deliver a seamless dining experience.",
      },
    ],
  },
  testimonials: {
    subtitle: "Customer Review",
    items: [
      {
        id: "test-1",
        author: "Maria Santos",
        role: "Wedding Client",
        quote: "Roxan Policarpio Events & Catering made our dream wedding a reality. The food was absolutely exquisite, the presentation was flawless, and it didn't break the bank. Truly exceptional service!",
        rating: 5,
        featured: true,
        active: true,
      },
      {
        id: "test-2",
        author: "Carlos & Elena Mendoza",
        role: "Silver Anniversary",
        quote: "Our guests could not stop praising the roast beef and pasta dishes. The setup was breathtaking and the staff was attentive throughout the evening.",
        rating: 5,
        featured: false,
        active: true,
      },
      {
        id: "test-3",
        author: "TechNova Corp Logistics",
        role: "Corporate Year-End Gala",
        quote: "Seamless catering for over 350 executives and partners. Punctual, hygienic, delicious, and impeccably managed from start to finish.",
        rating: 5,
        featured: false,
        active: true,
      },
    ],
  },
  faqs: {
    subtitle: "Common Inquiries",
    items: [
      {
        id: "faq-1",
        question: "How early should we reserve our catering date?",
        answer: "We recommend reserving at least 1 to 3 months in advance for peak wedding and holiday seasons to guarantee date availability.",
        category: "Booking",
        active: true,
      },
      {
        id: "faq-2",
        question: "Can we customize or taste the menu before finalizing?",
        answer: "Yes! Food tastings can be scheduled for confirmed inquiries and packages, allowing you to select and adjust dish options to your taste.",
        category: "Menu",
        active: true,
      },
      {
        id: "faq-3",
        question: "Do you cater outside Rizal and Metro Manila?",
        answer: "Yes, we cater across neighboring provinces such as Cavite, Laguna, Batangas, and Bulacan subject to out-of-town logistics fees.",
        category: "Logistics",
        active: true,
      },
    ],
  },
  footer: {
    brandName: "Roxan Policarpio Events & Catering",
    copyrightText: "All Rights Reserved.",
    quickLinks: [
      { name: "Facebook", url: "https://facebook.com" },
      { name: "Instagram", url: "https://instagram.com" },
      { name: "Inquire Now", url: "/booking" },
    ],
  },
};

const LOCAL_STORAGE_CMS_KEY = "rp_cms_content_cache";

// Realtime broadcast channel shared with Customer
const broadcastChannel = supabase.channel("cms-broadcast");
broadcastChannel.subscribe();

/**
 * Loads the CMS content from Supabase (or localStorage/defaults as reliable fallback)
 */
export async function fetchCMSContent(): Promise<FullCMSData> {
  const result: FullCMSData = { ...DEFAULT_CMS_DATA };

  // 1. Read local cache first for instant load
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CMS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.assign(result, parsed);
    }
  } catch (e) {
    console.warn("Failed reading local CMS cache:", e);
  }

  // 2. Fetch from Supabase primary table `cms_content`
  let loadedFromPrimary = false;
  try {
    const { data, error } = await supabase.from("cms_content").select("*");
    if (!error && data && data.length > 0) {
      data.forEach((row: any) => {
        if (row.id && row.data && (result as any)[row.id] !== undefined) {
          (result as any)[row.id] = {
            ...(DEFAULT_CMS_DATA as any)[row.id],
            ...row.data,
          };
        }
      });
      loadedFromPrimary = true;
    }
  } catch (err) {
    console.warn("Supabase fetchCMSContent cms_content error:", err);
  }

  // 3. Dual-layer fallback: Fetch from Supabase `inclusions` table (where category like '__CMS_%')
  if (!loadedFromPrimary) {
    try {
      const { data, error } = await supabase
        .from("inclusions")
        .select("*")
        .like("category", "__CMS_%");

      if (!error && data && data.length > 0) {
        data.forEach((row: any) => {
          const sectionKey = row.category.replace("__CMS_", "");
          if (sectionKey && (result as any)[sectionKey] !== undefined) {
            try {
              const parsed = JSON.parse(row.items);
              (result as any)[sectionKey] = {
                ...(DEFAULT_CMS_DATA as any)[sectionKey],
                ...parsed,
              };
            } catch (e) {}
          }
        });
      }
    } catch (err) {
      console.warn("Supabase fetchCMSContent inclusions fallback error:", err);
    }
  }

  // Update local cache
  try {
    localStorage.setItem(LOCAL_STORAGE_CMS_KEY, JSON.stringify(result));
  } catch (e) {}

  return result;
}

/**
 * Saves a specific section of the CMS to Supabase and local cache
 */
export async function saveCMSSection<K extends keyof FullCMSData>(
  sectionKey: K,
  data: FullCMSData[K],
  userName = "Admin User"
): Promise<{ success: boolean; message?: string }> {
  // 1. Update local storage cache immediately
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CMS_KEY);
    const parsed = cached ? JSON.parse(cached) : { ...DEFAULT_CMS_DATA };
    parsed[sectionKey] = data;
    localStorage.setItem(LOCAL_STORAGE_CMS_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.warn("Error updating local storage cache for CMS:", e);
  }

  // 2. Broadcast event across windows/tabs
  try {
    window.dispatchEvent(
      new CustomEvent("cms_section_updated", {
        detail: { section: sectionKey, data },
      })
    );
  } catch (e) {}

  // 3. Send over Supabase Realtime broadcast channel
  try {
    broadcastChannel.send({
      type: "broadcast",
      event: "cms_update",
      payload: { section: sectionKey, data },
    });
  } catch (e) {}

  // 4. Save to primary `cms_content` table
  try {
    await supabase.from("cms_content").upsert({
      id: sectionKey,
      section: sectionKey,
      data: data as any,
      updated_at: new Date().toISOString(),
      updated_by: userName,
    });
  } catch (err: any) {
    console.warn("Primary cms_content table save notice:", err?.message);
  }

  // 5. Always ALSO save to `inclusions` table under '__CMS_<sectionKey>' for guaranteed cross-device persistence
  try {
    const fallbackCategory = `__CMS_${String(sectionKey)}`;
    // Delete existing fallback row for this section then insert fresh
    await supabase.from("inclusions").delete().eq("category", fallbackCategory);
    await supabase.from("inclusions").insert({
      category: fallbackCategory,
      items: JSON.stringify(data),
    });
  } catch (err: any) {
    console.warn("Inclusions fallback save error:", err?.message);
  }

  // 6. Audit log
  try {
    await logAuditAction({
      action: `Updated CMS: ${String(sectionKey).toUpperCase()}`,
      target: `Website ${String(sectionKey)} Section`,
      type: "Update",
      details: `Admin modified customer-facing ${sectionKey} content.`,
    });
  } catch (e) {}

  return { success: true };
}
