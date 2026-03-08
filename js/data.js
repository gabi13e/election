// =====================================================
// data.js — Sample Data for Testing
// =====================================================

const SAMPLE_DATA = {
  voters: [
    { student_id: "2021-00101", full_name: "Maria Santos", school_email: "m.santos@sjp2cd.edu.ph", course: "BSIT", year_level: "4th Year", eligible: true, has_voted: false },
    { student_id: "2022-00202", full_name: "Juan dela Cruz", school_email: "j.delacruz@sjp2cd.edu.ph", course: "BSCS", year_level: "3rd Year", eligible: true, has_voted: false },
    { student_id: "2023-00303", full_name: "Ana Reyes", school_email: "a.reyes@sjp2cd.edu.ph", course: "BSBA", year_level: "2nd Year", eligible: true, has_voted: false },
    { student_id: "2020-00404", full_name: "Carlo Mendoza", school_email: "c.mendoza@sjp2cd.edu.ph", course: "BSED", year_level: "4th Year", eligible: true, has_voted: true },
    { student_id: "2021-00505", full_name: "Liza Garcia", school_email: "l.garcia@sjp2cd.edu.ph", course: "BSIT", year_level: "3rd Year", eligible: true, has_voted: false },
  ],

  candidates: [
    // PRESIDENT
    { candidate_id: "C001", full_name: "Ramon Aquino",   position: "President", course: "BSIT", year_level: "4th Year", party: "Lakbay",      platform: "My vision is to strengthen the academic programs of our organization, build stronger industry partnerships, and ensure every member has access to quality learning opportunities.", photo_url: "" },
    { candidate_id: "C002", full_name: "Clarissa Flores", position: "President", course: "BSCS", year_level: "4th Year", party: "Bayan",       platform: "As your President, I will focus on innovation and inclusivity. I want to launch new tech-driven initiatives, expand our alumni network, and create mentorship programs.", photo_url: "" },

    // VICE PRESIDENT
    { candidate_id: "C003", full_name: "Mark Villanueva", position: "Vice President", course: "BSCS", year_level: "3rd Year", party: "Lakbay", platform: "I will assist the President in all organizational matters and act as a strong liaison between the officers and members.", photo_url: "" },
    { candidate_id: "C004", full_name: "Joanna Lim",      position: "Vice President", course: "BSIT", year_level: "3rd Year", party: "",       platform: "Dedicated to serving every AAA member with integrity and passion. I will create structured feedback channels and ensure that every voice is heard.", photo_url: "" },

    // SECRETARY
    { candidate_id: "C005", full_name: "Patricia Cruz",  position: "Secretary", course: "BSBA", year_level: "2nd Year", party: "Bayan",        platform: "Organized, reliable, and detail-oriented — I will keep all organizational records accurate and accessible.", photo_url: "" },

    // TREASURER
    { candidate_id: "C006", full_name: "Miguel Tan",     position: "Treasurer", course: "BSBA", year_level: "3rd Year", party: "Lakbay",       platform: "Financial transparency is non-negotiable. I will maintain accurate financial records and publish regular budget reports.", photo_url: "" },
    { candidate_id: "C007", full_name: "Sophia Ramos",   position: "Treasurer", course: "BSIT", year_level: "2nd Year", party: "",             platform: "I believe in responsible stewardship of our organization's resources. I will introduce digital financial tracking.", photo_url: "" },

    // AUDITOR
    { candidate_id: "C008", full_name: "Kenneth Bautista", position: "Auditor", course: "BSBA", year_level: "3rd Year", party: "Bayan",        platform: "As your Auditor, I will conduct regular and independent checks on the organization's finances.", photo_url: "" },

    // PUBLIC RELATIONS OFFICER
    { candidate_id: "C009", full_name: "Andrea Navarro", position: "Public Relations Officer", course: "BSCS", year_level: "2nd Year", party: "Lakbay", platform: "A strong public image starts with authentic storytelling. I will manage our social media presence and build connections with other organizations.", photo_url: "" },
    { candidate_id: "C010", full_name: "Bryan Ocampo",   position: "Public Relations Officer", course: "BSIT", year_level: "3rd Year", party: "",        platform: "I will position AAA as the most visible and respected student organization in our department.", photo_url: "" },
  ],
};