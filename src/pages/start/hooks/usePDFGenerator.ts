import jsPDF from "jspdf";

const calculateGrade = (score: number) => {
  if (score >= 28) return 5;
  if (score >= 24) return 4;
  if (score >= 18) return 3;
  return 2;
};

export default function usePDFGenerator() {
  const generatePDF = (record: {
    id: number;
    name: string;
    shots: number[];
    score: number;
  }) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Shooting Result", 20, 20);
    doc.setFontSize(12);
    doc.text(`Name: ${record.name}`, 20, 40);
    doc.text(`Score: ${record.score}`, 20, 50);
    doc.text(`Shots: ${record.shots.join(", ")}`, 20, 60);
    doc.text(`Grade: ${calculateGrade(record.score)}`, 20, 70);
    doc.save(`result-${record.name || record.id}.pdf`);
  };

  return { generatePDF };
}
