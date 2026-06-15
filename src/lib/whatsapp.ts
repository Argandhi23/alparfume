export const formatRupiah = (price: number): string => {
  return "Rp" + price.toLocaleString("id-ID");
};

export const getWhatsAppLink = (productName: string, sizeMl: number, price: number): string => {
  const waNumber = process.env.NEXT_PUBLIC_WA_NUMBER || "6281915931190";
  const formattedPrice = formatRupiah(price);
  
  const message = `Halo, saya ingin memesan ${productName} ukuran ${sizeMl}ml seharga ${formattedPrice}. Apakah tersedia untuk COD area Madiun?`;
  
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
};
