// Plain browser script: no build step or module loader is required.
(function (KC) {
  "use strict";
  const { money, balance } = KC.calculations;
  // Browser-native PDF vectors and text, with explicit A4 pagination. No HTML screenshots.
  async function makePDF(d, ctx) {
    const { PDFDocument, StandardFonts, rgb, degrees } = globalThis.PDFLib;
    if (!PDFDocument) throw Error("PDF library unavailable. Reload the page.");
    const pdf = await PDFDocument.create();
    pdf.setTitle(
      `${ctx.credit?.number || d.number || "Draft"} — Krishna's Construction`,
    );
    pdf.setAuthor(ctx.settings.business_name || "Krishna's Construction");
    const regular = await pdf.embedFont(StandardFonts.Helvetica),
      bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ink = rgb(0.12, 0.12, 0.12),
      muted = rgb(0.43, 0.43, 0.43),
      gold = rgb(0.76, 0.56, 0.26),
      light = rgb(0.96, 0.95, 0.93),
      charcoal = rgb(0.12, 0.12, 0.12);
    const sample = ctx.sample,
      settings = ctx.settings || {},
      b = d.body || {},
      t = d.totals,
      c = ctx.customer?.data || {},
      j = ctx.job || {};
    const clean = (v) =>
      String(v ?? "")
        .replace(/\t/g, "  ")
        .replace(/[\u2010-\u2015]/g, "-")
        .replace(/[\u2000-\u200b\u202f\u00a0]/g, " ")
        .split("")
        .map((ch) => {
          try {
            regular.encodeText(ch);
            return ch;
          } catch {
            return "?";
          }
        })
        .join("");
    const width = (s, font = regular, size = 9) =>
      font.widthOfTextAtSize(clean(s), size);
    const title = ctx.credit
      ? "ADJUSTMENT NOTE"
      : d.kind === "quote"
        ? "QUOTATION"
        : d.kind === "booking"
          ? "BOOKING CONFIRMATION"
          : b.tax === "taxable" && settings.gst_registered
            ? "TAX INVOICE"
            : "INVOICE";
    let logo = await embed(
      settings.logo_path
        ? await ctx.asset(settings.logo_path)
        : KC.assets.logoBytes(),
    );
    async function embed(bytes) {
      try {
        return await pdf.embedPng(bytes);
      } catch {
        return await pdf.embedJpg(bytes);
      }
    }
    let page,
      y,
      pageNumber = 0;
    const pages = [];
    function text(s, x, ypos, size = 9, font = regular, color = ink) {
      page.drawText(clean(s), { x, y: ypos, size, font, color });
    }
    function right(s, x, ypos, size = 9, font = regular, color = ink) {
      text(s, x - width(s, font, size), ypos, size, font, color);
    }
    function newPage() {
      page = pdf.addPage([595.28, 841.89]);
      pages.push(page);
      pageNumber++;
      page.drawRectangle({ x: 0, y: 825, width: 595.28, height: 17, color: charcoal });
      page.drawRectangle({ x: 40, y: 808, width: 515, height: 2, color: gold });
      text(settings.business_name || "Krishna's Construction", 40, 786, 10, bold);
      right(ctx.credit?.number || d.number || "DRAFT", 555, 786, 9, regular, muted);
      y = 756;
    }
    function ensure(height = 30) {
      if (y - height < 65) newPage();
    }
    function wrap(s, max = 515, size = 9, font = regular) {
      const result = [];
      for (const paragraph of String(s ?? "").split("\n")) {
        if (!paragraph) {
          result.push("");
          continue;
        }
        let line = "";
        for (const word of clean(paragraph).split(/\s+/)) {
          if (width(word, font, size) > max) {
            if (line) {
              result.push(line);
              line = "";
            }
            let chunk = "";
            for (const ch of word) {
              if (width(chunk + ch, font, size) > max) {
                result.push(chunk);
                chunk = ch;
              } else chunk += ch;
            }
            line = chunk;
            continue;
          }
          if (line && width(line + " " + word, font, size) > max) {
            result.push(line);
            line = word;
          } else line += (line ? " " : "") + word;
        }
        result.push(line);
      }
      return result;
    }
    function para(
      s,
      {
        size = 9,
        font = regular,
        color = ink,
        x = 40,
        max = 515,
        gap = 3,
      } = {},
    ) {
      const lines = wrap(s, max, size, font);
      for (const line of lines) {
        ensure(size + 8);
        text(line, x, y, size, font, color);
        y -= size + 5;
      }
      y -= gap;
    }
    function section(s) {
      ensure(55);
      y -= 8;
      text(s.toUpperCase(), 40, y, 9, bold, gold);
      y -= 15;
    }
    function rule() {
      page.drawLine({
        start: { x: 40, y },
        end: { x: 555, y },
        thickness: 0.6,
        color: light,
      });
      y -= 12;
    }
    function summary(label, value, grand = false) {
      ensure(grand ? 45 : 22);
      if (grand) {
        y -= 4;
        page.drawRectangle({x: 294, y: y - 12, width: 261, height: 34, color: charcoal});
      }
      text(label, grand ? 306 : 300, y, grand ? 10 : 9, grand ? bold : regular, grand ? rgb(1,1,1) : muted);
      right(value, 545, y, grand ? 13 : 9, grand ? bold : regular, grand ? rgb(0.91,0.73,0.44) : ink);
      y -= grand ? 36 : 18;
    }
    const dateLabel = value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return value || "To be confirmed";
      return new Intl.DateTimeFormat("en-AU", {day:"numeric", month:"short", year:"numeric", timeZone:"UTC"}).format(new Date(value + "T12:00:00Z"));
    };
    newPage();
    // A generous brand masthead; the supplied artwork retains its aspect ratio.
    page.drawRectangle({x:0,y:690,width:595.28,height:152,color:charcoal});
    page.drawRectangle({x:40,y:690,width:515,height:3,color:gold});
    const logoScale = Math.min(132 / logo.width, 124 / logo.height);
    page.drawImage(logo, {x:40,y:704,width:logo.width*logoScale,height:logo.height*logoScale});
    right("SPECIALISTS IN CARPENTRY",555,806,8,bold,gold);
    right(title,555,774,title.length > 17 ? 18 : 27,bold,rgb(1,1,1));
    right(ctx.credit?.number || d.number || "DRAFT",555,750,11,bold,gold);
    right("Issued  " + dateLabel(ctx.credit ? String(ctx.credit.created_at).slice(0,10) : b.date),555,729,9,regular,rgb(0.88,0.88,0.88));
    if (d.kind === "quote" && b.expiry_date) right("Valid until  " + dateLabel(b.expiry_date),555,712,9,regular,rgb(0.88,0.88,0.88));
    if (d.kind === "invoice" && b.due_date && !ctx.credit) right("Payment due  " + dateLabel(b.due_date),555,712,9,regular,rgb(0.88,0.88,0.88));
    y=672;
    para([settings.abn ? "ABN " + settings.abn : "",settings.phone,settings.email].filter(Boolean).join("  |  "),{size:8,color:muted,gap:0});
    if(settings.address) para(settings.address,{size:8,color:muted,gap:0});
    y-=12;
    const top=y;
    const leftLines=[c.company && c.company !== "None" ? c.company : "",c.name,c.abn ? "ABN " + c.abn : "",c.billing_address,c.email,c.phone,ctx.customer?.number].filter(Boolean).flatMap(v=>wrap(v,230,9));
    const jobLines=(ctx.credit ? [d.number,b.title] : [b.title || j.data?.title || "Job details",b.site_address,j.number]).filter(Boolean).flatMap(v=>wrap(v,230,9));
    const cardHeight = Math.max(leftLines.length,jobLines.length)*13+43;
    page.drawRectangle({x:40,y:top-cardHeight,width:515,height:cardHeight,color:light});
    page.drawLine({start:{x:299,y:top-14},end:{x:299,y:top-cardHeight+14},thickness:0.6,color:rgb(0.85,0.82,0.76)});
    text(d.kind === "invoice" ? "BILLED TO" : "PREPARED FOR",54,top-19,8,bold,gold);
    text(ctx.credit ? "RELATED INVOICE" : "PROJECT DETAILS",313,top-19,8,bold,gold);
    leftLines.forEach((line,n)=>text(line,54,top-38-n*13,9,n===0?bold:regular));
    jobLines.forEach((line,n)=>text(line,313,top-38-n*13,9,n===0?bold:regular));
    y=top-cardHeight-15;
    if (ctx.credit) {
      section("Credit adjustment");
      para(ctx.credit.reason);
      summary("Credit (including GST)", money(ctx.credit.amount_cents), true);
      summary("GST credit component", money(ctx.credit.gst_cents));
      para(
        "This adjustment note relates to the invoice identified above. Retain both records together.",
        { color: muted },
      );
    } else {
      if (d.status === "void" || d.status === "cancelled") {
        section(d.status === "void" ? "VOID — NOT PAYABLE" : "CANCELLED");
        para(b.void_reason || "This document is no longer current.");
      }
      if (b.quote_type === "cost-plus") {
        section(
          "Cost-plus " +
            (b.cost_basis === "actual" ? "actual costs" : "estimate"),
        );
        para(
          `Direct costs plus ${b.fee_method === "fixed" ? money(b.fee_cents) + " management fee" : b.markup_percent + "% markup"}. ${b.cost_basis === "actual" ? "Amounts reflect entered actual costs." : "Amounts are estimates, not an unconditional fixed price."}`,
        );
      }
      if (b.summary) {
        section("Work summary");
        para(b.summary);
      }
      if (b.scope?.length) {
        section("Scope of works");
        b.scope.forEach((s, i) => para(`${i + 1}. ${s}`));
      }
      for (const [key, label] of [
        ["exclusions", "Exclusions"],
        ["assumptions", "Material assumptions"],
        ["notes", "Additional notes"],
      ])
        if (b[key] && (d.kind !== "quote" || key === "notes")) {
          section(label);
          para(b[key]);
        }
      for (const [category, label] of (d.kind === "invoice" ? [[null, "Itemised charges"]] : [
        ["labour", "Labour"],
        ["materials", "Materials"],
        ["additional", "Additional costs"],
        ["variation", "Variations"],
      ])) {
        const items = category === null ? t.items : t.items.filter((i) => i.category === category);
        if (!items.length) continue;
        ensure(78); // Keep the category heading, table header and first row together.
        section(label);
        tableHeader();
        for (const i of items) {
          const lines = wrap(
            i.description || "Description not provided",
            258,
            9,
          );
          const quantityLines = wrap(
            String(i.quantity) + " " + (i.unit || ""),
            70,
            8,
          );
          while (lines.length < quantityLines.length) lines.push("");
          let offset = 0;
          while (offset < lines.length) {
            const capacity = Math.floor((y - 73) / 14);
            if (capacity < 1) {
              newPage();
              tableHeader();
              continue;
            }
            const chunk = lines.slice(offset, offset + Math.min(capacity, 45));
            chunk.forEach((l, n) => text(l, 46, y - n * 14));
            quantityLines
              .slice(offset, offset + chunk.length)
              .forEach((l, n) => right(l, 383, y - n * 14, 8));
            if (offset === 0) {
              right(money(i.rate_cents), 469, y, 8);
              right(money(i.amount_cents), 549, y, 9, bold);
            }
            y -= chunk.length * 14 + 5;
            offset += chunk.length;
            if (offset < lines.length) {
              newPage();
              tableHeader();
            }
          }
          page.drawLine({start:{x:40,y:y+3},end:{x:555,y:y+3},thickness:0.4,color:light});
          y-=5;
        }
      }
      function tableHeader() {
        ensure(60);
        y -= 5; // Leave the category label clear of the header background.
        page.drawRectangle({
          x: 40,
          y: y - 7,
          width: 515,
          height: 25,
          color: charcoal,
        });
        text("DESCRIPTION", 46, y + 2, 7, bold, gold);
        right("QTY / HOURS", 383, y + 2, 7, bold, gold);
        right("UNIT PRICE", 469, y + 2, 7, bold, gold);
        right("AMOUNT", 549, y + 2, 7, bold, gold);
        y -= 29;
      }
      ensure(d.kind === "invoice" ? 225 : 178);
      section("Price summary");
      if (b.price_mode === "inclusive")
        para("Entered cost rows include GST where applicable.", {
          size: 8,
          color: muted,
        });
      else para("Entered cost rows exclude GST.", { size: 8, color: muted });
      const pricePage = page,
        paidMarkY = y;
      if (t.adjustment_cents)
        summary("Fixed price adjustment", money(t.adjustment_cents));
      if (t.fee_cents) summary("Cost-plus fee", money(t.fee_cents));
      if (t.discount_cents) summary("Discount", money(-t.discount_cents));
      summary("Net charges (ex GST)", money(t.net_cents));
      summary("GST component", money(t.gst_cents));
      summary(
        b.quote_type === "cost-plus" && b.cost_basis === "estimated"
          ? "Estimated total AUD"
          : "Total AUD",
        money(t.total_cents),
        true,
      );
      if (b.tax !== "taxable")
        para(
          "Tax treatment: " +
            b.tax +
            " — " +
            (b.tax_reason || "Basis not supplied"),
          { size: 8, color: muted },
        );
      const payments = ctx.payments || [];
      if (d.kind === "invoice") {
        const paid = payments.filter((p) => p.invoice_id === d.id),
          bal = balance(t.total_cents, paid, d.credit_cents || 0);
        if (d.credit_cents) summary("Credits applied", money(d.credit_cents));
        for (const p of paid)
          summary(
            p.kind === "deposit"
              ? "Deposit received"
              : "Final payment received",
            money(p.amount_cents),
          );
        summary("Balance due", money(bal.due), true);
        if (
          d.status !== "draft" &&
          d.status !== "void" &&
          bal.due === 0 &&
          bal.paid > 0 &&
          !sample
        ) {
          const besideTotals =
            page === pricePage && paidMarkY > 170 && b.tax === "taxable";
          if (!besideTotals) ensure(75);
          const stampY = besideTotals ? paidMarkY - 70 : y;
          page.drawRectangle({
            x: 40,
            y: stampY - 24,
            width: 112,
            height: 40,
            borderColor: rgb(0.25, 0.42, 0.29),
            borderWidth: 1.8,
            color: rgb(1, 1, 1),
            rotate: degrees(-4),
          });
          text("PAID", 53, stampY - 7, 24, bold, rgb(0.25, 0.42, 0.29));
          if (!besideTotals) y -= 52;
          const date = paid
            .map((p) => p.paid_date)
            .sort()
            .at(-1);
          if (besideTotals) {
            text("Paid date: " + date, 40, stampY - 48, 8, regular, muted);
            text(
              "Total received: " + money(bal.paid),
              40,
              stampY - 61,
              8,
              regular,
              muted,
            );
          } else
            para(
              "Paid date: " + date + " · Total received: " + money(bal.paid),
              {
                size: 9,
                color: muted,
              },
            );
        }
      } else {
        summary("Deposit requested", money(t.deposit_cents));
        if (d.kind === "booking") {
          const received = payments.filter((p) => p.kind === "deposit");
          summary(
            "Deposit actually received",
            money(received.reduce((s, p) => s + p.amount_cents, 0)),
          );
          received.forEach((p) =>
            para(
              "Received " +
                p.paid_date +
                " by " +
                p.method +
                (p.reference ? " · " + p.reference : ""),
              { size: 8, color: muted },
            ),
          );
        } else
          summary(
            "After requested deposit",
            money(t.total_cents - t.deposit_cents),
          );
      }
      if (d.kind === "booking") {
        section("Booking details");
        para(
          [
            "Start: " + (b.start_date || "To be agreed"),
            "Expected completion: " + (b.end_date || "To be agreed"),
            b.booked_by ? "Booked by: " + b.booked_by : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
      const bank = [
        settings.bank_name ? "Account name: " + settings.bank_name : "",
        settings.bsb ? "BSB: " + settings.bsb : "",
        settings.account_number
          ? "Account number: " + settings.account_number
          : "",
        settings.payment_instructions,
      ].filter(Boolean);
      if (bank.length) {
        section("Payment instructions");
        para(bank.join("\n"));
      }
      if (d.kind === "quote") {
        ensure(85);
        section("Quotation validity & deposit");
        para(
          "This quotation is valid " +
            (b.expiry_date ? ((new Date(b.expiry_date) - new Date(b.date)) / 86400000 === 14 ? "for 14 days from the issue date, until " : "until ") + dateLabel(b.expiry_date) : "to be agreed") +
            ". Requested deposit: " +
            money(t.deposit_cents) +
            ". A requested deposit is not a recorded payment.",
        );
        for (const [key, label] of [
          ["exclusions", "Exclusions"],
          ["assumptions", "Material assumptions"],
        ])
          if (b[key]) {
            section(label);
            para(b[key]);
          }
      }
      if (b.terms) {
        const termsLines=wrap(b.terms,515,8.5);
        if(termsLines.length*12+65 > y-65 && y < 600) newPage();
        section("Terms & conditions");
        for(const paragraph of String(b.terms).split("\n")) {
          const heading=/^\d+\. /.test(paragraph);
          if(heading) ensure(48);
          para(paragraph,{size:8.5,font:heading?bold:regular,color:heading?ink:muted,gap:heading?0:6});
        }
      }
      if (d.kind === "booking" && b.special_instructions) {
        section("Special instructions");
        para(b.special_instructions);
      }
      if (d.kind === "quote") {
        section("Customer acceptance (optional)");
        para(
          "Name: __________________________________________\nSignature: _______________________________________\nDate: ___________________________________________",
          { color: muted },
        );
      }
      if (b.use_signature) {
        section("Authorisation");
        if (sample && !settings.signature_path)
          para("SAMPLE SIGNATURE — NOT A REAL SIGNATURE", {
            font: bold,
            color: muted,
          });
        else if (settings.signature_path) {
          const sig = await embed(await ctx.asset(settings.signature_path));
          ensure(80);
          const scale = Math.min(150 / sig.width, 65 / sig.height);
          page.drawImage(sig, {
            x: 40,
            y: y - 65,
            width: sig.width * scale,
            height: sig.height * scale,
          });
          y -= 80;
        } else throw Error("Genuine signature is unavailable.");
      }
      if (b.use_stamp) {
        ensure(125);
        if (settings.stamp_path) {
          const stamp = await embed(await ctx.asset(settings.stamp_path));
          const scale = Math.min(110 / stamp.width, 100 / stamp.height);
          page.drawImage(stamp, {
            x: 40,
            y: y - 100,
            width: stamp.width * scale,
            height: stamp.height * scale,
          });
        } else {
          page.drawRectangle({
            x: 40,
            y: y - 100,
            width: 180,
            height: 100,
            color: charcoal,
            borderColor: gold,
            borderWidth: 1,
          });
          page.drawImage(logo, { x: 45, y: y - 94, width: 80, height: 80 });
          text("COMPANY MARK", 125, y - 35, 7, bold, gold);
          text("ABN", 125, y - 52, 6, regular, rgb(0.9, 0.8, 0.65));
          text(
            settings.abn || "",
            125,
            y - 65,
            6,
            regular,
            rgb(0.9, 0.8, 0.65),
          );
        }
        y -= 115;
      }
    }
    ensure(38);
    y-=10;
    text("Thank you for choosing Krishna's Construction.",40,y,10,bold);
    text("We look forward to working with you.",40,y-16,8,regular,muted);
    const count = pages.length;
    pages.forEach((p, n) => {
      p.drawLine({
        start: { x: 40, y: 49 },
        end: { x: 555, y: 49 },
        color: gold,
        thickness: 1,
      });
      p.drawText(clean(settings.business_name || "Krishna's Construction"), {
        x: 40,
        y: 32,
        size: 7,
        font: regular,
        color: muted,
      });
      p.drawText(`${n + 1} / ${count}`, {
        x: 523,
        y: 32,
        size: 7,
        font: regular,
        color: muted,
      });
      if (sample) {
        p.drawText("SAMPLE / NOT FOR ISSUE", {
          x: 165,
          y: 32,
          size: 10,
          font: bold,
          color: rgb(0.65, 0.28, 0.2),
        });
        p.drawText("SAMPLE", {
          x: 175,
          y: 385,
          size: 58,
          font: bold,
          color: rgb(0.8, 0.75, 0.65),
          opacity: 0.12,
          rotate: degrees(30),
        });
      } else if (d.status === "void") {
        p.drawText("VOID", {
          x: 195,
          y: 385,
          size: 72,
          font: bold,
          color: rgb(0.7, 0.2, 0.2),
          opacity: 0.12,
          rotate: degrees(30),
        });
      }
    });
    return new Blob([await pdf.save()], { type: "application/pdf" });
  }

  KC.pdf = { makePDF };
})((globalThis.KC = globalThis.KC || {}));
