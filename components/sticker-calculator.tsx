"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const PRICING = {
  product: "Real Estate Stickers (Round)",
  currency: "AUD",
  sizes: [
    { name: "Small (400mm)", diameter: 400, price: 7.0 },
    { name: "Medium (500mm)", diameter: 500, price: 10.0 },
    { name: "Large (600mm)", diameter: 600, price: 12.0 },
    { name: "Extra Large (700mm)", diameter: 700, price: 15.0 },
  ],
  textOptions: ["SOLD", "LEASED", "FOR SALE", "UNDER CONTRACT", "UNDER OFFER", "AUCTION", "OPEN HOME"],
  colorOptions: [
    { value: "white-red", label: "White background, Red text", bg: "white", text: "red" },
    { value: "red-white", label: "Red background, White text", bg: "red", text: "white" },
    { value: "white-black", label: "White background, Black text", bg: "white", text: "black" },
    { value: "black-white", label: "Black background, White text", bg: "black", text: "white" },
    { value: "white-blue", label: "White background, Blue text", bg: "white", text: "blue" },
    { value: "blue-white", label: "Blue background, White text", bg: "blue", text: "white" },
  ],
  discountTiers: [
    { min: 1, max: 19, discount: 0 },
    { min: 20, max: 49, discount: 0.05 },
    { min: 50, max: 99, discount: 0.12 },
    { min: 100, max: 199, discount: 0.16 },
    { min: 200, max: Number.POSITIVE_INFINITY, discount: 0.22 },
  ],
  qtyTiers: [10, 20, 50, 100, 200, 300, 500, 1000],
}

function priceRealEstate({ sizeIndex, qty }: { sizeIndex: number; qty: number }) {
  const size = PRICING.sizes[sizeIndex]
  if (!size) throw new Error("Invalid size index")

  const q = Math.max(1, Math.floor(+qty || 1))

  // Find discount tier
  const tier = PRICING.discountTiers.find((t) => q >= t.min && q <= t.max)
  const discount = tier?.discount || 0

  const basePrice = size.price
  const unitPrice = basePrice * (1 - discount)
  const totalPrice = unitPrice * q

  return {
    size: { name: size.name, diameter: size.diameter },
    qty: q,
    basePrice: +basePrice.toFixed(2),
    unitPrice: +unitPrice.toFixed(2),
    totalPrice: +totalPrice.toFixed(2),
    discountPct: Math.round(discount * 100),
    nextTier: getNextTier(q),
  }
}

function getNextTier(qty: number) {
  const nextTier = PRICING.discountTiers.find((t) => qty < t.min)
  if (nextTier) {
    return {
      nextQty: nextTier.min,
      nextDiscountPct: Math.round(nextTier.discount * 100),
    }
  }
  return null
}

export default function StickerCalculator() {
  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [selectedText, setSelectedText] = useState("")
  const [selectedColorCombination, setSelectedColorCombination] = useState("")
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null)
  const [customQuantity, setCustomQuantity] = useState<number | null>(null)
  const [showCustomQuantity, setShowCustomQuantity] = useState(false)
  const [artworkMethod, setArtworkMethod] = useState("")
  const [shippingMethod, setShippingMethod] = useState("13.95")
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState<"configure" | "details">("configure")

  const quantity = customQuantity || selectedQuantity || 0

  let pricingResult = null
  let total = 0
  let unitPrice = 0
  let upsellMsg = ""

  if (selectedSize !== null && quantity > 0) {
    try {
      pricingResult = priceRealEstate({
        sizeIndex: selectedSize,
        qty: quantity,
      })

      total = pricingResult.totalPrice
      unitPrice = pricingResult.unitPrice

      if (pricingResult.nextTier) {
        upsellMsg = `Save ${pricingResult.nextTier.nextDiscountPct}% when you add ${pricingResult.nextTier.nextQty - quantity} stickers`
      } else if (pricingResult.discountPct > 0) {
        upsellMsg = `You saved ${pricingResult.discountPct}%`
      }
    } catch (error) {
      console.error("Pricing error:", error)
    }
  }

  useEffect(() => {
    const savedImages = localStorage.getItem("sticker-artwork-images")
    if (savedImages) {
      setUploadedImages(JSON.parse(savedImages))
    }
  }, [])

  useEffect(() => {
    if (uploadedImages.length > 0) {
      localStorage.setItem("sticker-artwork-images", JSON.stringify(uploadedImages))
    } else {
      localStorage.removeItem("sticker-artwork-images")
    }
  }, [uploadedImages])

  useEffect(() => {
    if (total >= 60) {
      setShippingMethod("0") // Free Standard
    } else if (total >= 100) {
      setShippingMethod("0") // Free Express
    } else {
      if (shippingMethod === "0") {
        setShippingMethod("13.95")
      }
    }
  }, [total])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newImageUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

        const { data, error } = await supabase.storage.from("artwork-files").upload(fileName, file)

        if (error) {
          console.error("Upload error:", error)
          alert(`Failed to upload ${file.name}. Please try again.`)
          continue
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("artwork-files").getPublicUrl(fileName)

        newImageUrls.push(publicUrl)
      }

      if (newImageUrls.length > 0) {
        setUploadedImages((prev) => [...prev, ...newImageUrls])
      }
    } catch (error) {
      console.error("Error uploading images:", error)
      alert("Upload failed. Please check your connection and try again.")
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  const removeImage = (imageUrl: string) => {
    setUploadedImages((prev) => prev.filter((url) => url !== imageUrl))
  }

  const handleContinue = () => {
    if (currentStep === "configure") {
      setCurrentStep("details")
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    setCurrentStep("configure")
  }

  const handleSubmit = () => {
    console.log("Form submitted - Ready to order!")
  }

  const isFormReady = selectedSize !== null && (selectedQuantity || customQuantity)

  const getColorsFromCombination = (combination: string) => {
    switch (combination) {
      case "red-white":
        return { bg: "red", text: "white" }
      case "white-red":
        return { bg: "white", text: "red" }
      case "black-white":
        return { bg: "black", text: "white" }
      case "white-black":
        return { bg: "white", text: "black" }
      case "blue-white":
        return { bg: "blue", text: "white" }
      case "white-blue":
        return { bg: "white", text: "blue" }
      default:
        return { bg: "white", text: "black" }
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-2 sm:p-4 flex items-center justify-center">
      <div className="w-full max-w-xs sm:max-w-md lg:max-w-xl xl:max-w-2xl bg-white rounded-lg p-3 sm:p-6 lg:p-8 shadow-sm border border-gray-200">
        <form className="space-y-3 sm:space-y-6">
          {currentStep === "configure" && (
            <>
              <div className="space-y-2">
                <label className="text-gray-700 font-medium text-xs sm:text-sm">Size</label>
                <select
                  value={selectedSize ?? ""}
                  onChange={(e) => setSelectedSize(e.target.value ? Number(e.target.value) : null)}
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none text-sm sm:text-base"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.5rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select size</option>
                  {PRICING.sizes.map((size, index) => (
                    <option key={index} value={index}>
                      {size.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-gray-700 font-medium text-xs sm:text-sm">Text</label>
                <select
                  value={selectedText}
                  onChange={(e) => setSelectedText(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none text-sm sm:text-base"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.5rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select text</option>
                  {PRICING.textOptions.map((text) => (
                    <option key={text} value={text}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-gray-700 font-medium text-xs sm:text-sm">Color</label>
                <div className="flex gap-2 sm:gap-3 flex-wrap">
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="colorCombination"
                      value="white-red"
                      checked={selectedColorCombination === "white-red"}
                      onChange={(e) => setSelectedColorCombination(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 ${selectedColorCombination === "white-red" ? "border-gray-800" : "border-gray-300"}`}
                    >
                      <img
                        src="/red-white.jpg"
                        alt="Red background, White text"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </label>

                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="colorCombination"
                      value="red-white"
                      checked={selectedColorCombination === "red-white"}
                      onChange={(e) => setSelectedColorCombination(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 ${selectedColorCombination === "red-white" ? "border-gray-800" : "border-gray-300"}`}
                    >
                      <img
                        src="/white-red.jpg"
                        alt="White background, Red text"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </label>

                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="colorCombination"
                      value="white-black"
                      checked={selectedColorCombination === "white-black"}
                      onChange={(e) => setSelectedColorCombination(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 ${selectedColorCombination === "white-black" ? "border-gray-800" : "border-gray-300"}`}
                    >
                      <img
                        src="/black-white.jpg"
                        alt="Black background, White text"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </label>

                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="colorCombination"
                      value="black-white"
                      checked={selectedColorCombination === "black-white"}
                      onChange={(e) => setSelectedColorCombination(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 ${selectedColorCombination === "black-white" ? "border-gray-800" : "border-gray-300"}`}
                    >
                      <img
                        src="/white-black.jpg"
                        alt="White background, Black text"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </label>

                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="colorCombination"
                      value="white-blue"
                      checked={selectedColorCombination === "white-blue"}
                      onChange={(e) => setSelectedColorCombination(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 ${selectedColorCombination === "white-blue" ? "border-gray-800" : "border-gray-300"}`}
                    >
                      <img
                        src="/blue-white.jpg"
                        alt="Blue background, White text"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </label>

                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="colorCombination"
                      value="blue-white"
                      checked={selectedColorCombination === "blue-white"}
                      onChange={(e) => setSelectedColorCombination(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full border-2 ${selectedColorCombination === "blue-white" ? "border-gray-800" : "border-gray-300"}`}
                    >
                      <img
                        src="/white-blue.jpg"
                        alt="White background, Blue text"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {selectedSize !== null &&
                selectedText &&
                selectedColorCombination &&
                (() => {
                  const colors = getColorsFromCombination(selectedColorCombination)
                  return (
                    <div className="space-y-2">
                      <label className="text-gray-700 font-medium text-xs sm:text-sm">Preview</label>
                      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 flex justify-center">
                        <div
                          className="rounded-full shadow-sm border-2 flex items-center justify-center font-bold text-center text-2xl sm:text-3xl"
                          style={{
                            backgroundColor: colors.bg,
                            color: colors.text,
                            width: "120px",
                            height: "120px",
                            borderColor: "#ccc",
                          }}
                        >
                          {selectedText}
                        </div>
                      </div>
                    </div>
                  )
                })()}

              <div className="space-y-2">
                <label htmlFor="quantity" className="text-gray-700 font-medium text-xs sm:text-sm">
                  Quantity
                </label>
                <select
                  id="quantity"
                  value={showCustomQuantity ? "custom" : selectedQuantity || ""}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setShowCustomQuantity(true)
                      setSelectedQuantity(null)
                    } else {
                      setShowCustomQuantity(false)
                      setSelectedQuantity(Number(e.target.value) || null)
                      setCustomQuantity(null)
                    }
                  }}
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none text-sm sm:text-base"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.5rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select</option>
                  {(() => {
                    if (selectedSize !== null) {
                      return PRICING.qtyTiers
                        .map((qty) => {
                          try {
                            const result = priceRealEstate({ sizeIndex: selectedSize, qty })
                            const discountText = result.discountPct > 0 ? ` (${result.discountPct}% off)` : ""
                            return (
                              <option key={qty} value={qty}>
                                {qty} stickers • ${result.totalPrice}
                                {discountText}
                              </option>
                            )
                          } catch {
                            return null
                          }
                        })
                        .filter(Boolean)
                    } else {
                      return PRICING.qtyTiers.map((q) => (
                        <option key={q} value={q}>
                          {q} stickers
                        </option>
                      ))
                    }
                  })()}
                  <option value="custom">Custom quantity</option>
                </select>

                {showCustomQuantity && (
                  <input
                    type="number"
                    min={1}
                    placeholder="Enter quantity"
                    className="border border-gray-300 rounded-md p-2 w-full mt-2 text-sm sm:text-base"
                    value={customQuantity ?? ""}
                    onChange={(e) => setCustomQuantity(Number(e.target.value) || null)}
                  />
                )}

                {quantity > 0 && upsellMsg && (
                  <div className="text-green-600 text-xs sm:text-sm font-medium">{upsellMsg}</div>
                )}
              </div>
            </>
          )}

          {currentStep === "details" && (
            <>
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-xs sm:text-sm"
              >
                ← Back
              </button>

              <div>
                <label className="text-gray-700 font-medium text-xs sm:text-sm block mb-3">
                  How will your print ready artwork be supplied?
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-xs sm:text-sm ${
                      artworkMethod === "ready" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => setArtworkMethod("ready")}
                  >
                    I have print-ready files
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-xs sm:text-sm ${
                      artworkMethod === "design" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => setArtworkMethod("design")}
                  >
                    Design my own online
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-xs sm:text-sm ${
                      artworkMethod === "help" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => setArtworkMethod("help")}
                  >
                    I need design assistance
                  </button>
                </div>
              </div>

              {artworkMethod === "ready" && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <label
                      htmlFor="upload-artwork"
                      className="block cursor-pointer text-gray-700 font-medium text-xs sm:text-sm"
                    >
                      {isUploading ? "Uploading..." : "Click to upload artwork"}
                    </label>
                    <input
                      type="file"
                      id="upload-artwork"
                      name="upload-artwork"
                      className="hidden"
                      multiple
                      accept=".ai,.eps,.pdf,.png,.jpg,.jpeg"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                      Accepted file types: ai, eps, pdf, png, jpg. Max: 250MB
                    </div>
                  </div>

                  {uploadedImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {uploadedImages.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={imageUrl || "/placeholder.svg"}
                              alt={`Uploaded artwork ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage(imageUrl)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-colors"
                            title="Remove image"
                          >
                            ❌
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {artworkMethod === "design" && (
                <div className="p-4 border border-gray-300 rounded bg-gray-50">
                  <p className="text-gray-700 text-xs sm:text-sm">Redirecting to Sticker Ninja Designer...</p>
                </div>
              )}

              {artworkMethod === "help" && (
                <div className="p-4 border border-gray-300 rounded bg-gray-50">
                  <p className="text-gray-700 text-sm">Feature coming soon...</p>
                </div>
              )}

              <div>
                <label htmlFor="shipping-method" className="text-gray-700 font-medium text-xs sm:text-sm block mb-2">
                  Shipping Method
                </label>
                <select
                  id="shipping-method"
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white text-sm sm:text-base"
                  disabled={total >= 60}
                >
                  {total >= 100 ? (
                    <option value="0">Express Shipping - FREE</option>
                  ) : total >= 60 ? (
                    <option value="0">Standard Shipping - FREE</option>
                  ) : (
                    <>
                      <option value="8.95">Standard Shipping - $8.95</option>
                      <option value="13.95">Express Shipping - $13.95</option>
                    </>
                  )}
                </select>
                {total >= 60 && (
                  <div className="text-green-600 text-xs sm:text-sm mt-2 font-medium">
                    You have received free Standard Shipping.
                  </div>
                )}
              </div>
            </>
          )}

          <div className="border-t border-gray-200 pt-4 sm:pt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl sm:text-4xl font-bold text-gray-900">${total.toFixed(2)}</div>
              <div className="text-gray-600 text-xs sm:text-sm">
                ${quantity > 0 ? (total / quantity).toFixed(2) : "0.00"} / sticker
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className={`w-full font-semibold py-3 px-4 rounded-md transition-colors text-sm sm:text-base ${
                isFormReady ? "bg-black text-white hover:bg-gray-800" : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!isFormReady}
            >
              {currentStep === "configure" ? "Continue" : "Ready to order?"}
            </button>

            {currentStep === "configure" && (
              <div className="text-center text-gray-500 text-xs sm:text-sm mt-2">Next: upload artwork →</div>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
