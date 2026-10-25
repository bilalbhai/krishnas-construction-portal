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
    const grid = rgb(0.77, 0.74, 0.68);
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
      const lines = wrap(s, max - 20, size, font);
      let offset = 0;
      while (offset < lines.length) {
        ensure(size + 22);
        const capacity = Math.max(1, Math.floor((y - 79) / (size + 4)));
        const chunk = lines.slice(offset, offset + capacity);
        const height = chunk.length * (size + 4) + 12;
        page.drawRectangle({ x, y: y - height + 5, width: max, height, borderColor: grid, borderWidth: 0.55 });
        chunk.forEach((line, n) => text(line, x + 10, y - 8 - n * (size + 4), size, /^\d+\. [A-Z]/.test(line) ? bold : font, color));
        y -= height;
        offset += chunk.length;
        if (offset < lines.length) newPage();
      }
      y -= gap;
    }
    function section(s) {
      ensure(55);
      y -= 5;
      page.drawRectangle({x:40,y:y-20,width:515,height:24,color:light,borderColor:grid,borderWidth:0.55});
      text(s.toUpperCase(), 50, y - 12, 9, bold, ink);
      y -= 25;
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
      else {
        page.drawRectangle({x:294,y:y-7,width:261,height:18,borderColor:grid,borderWidth:0.5});
        page.drawLine({start:{x:462,y:y-7},end:{x:462,y:y+11},color:grid,thickness:0.5});
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
    para([settings.abn ? "ABN " + settings.abn : "",settings.phone,settings.email,settings.address].filter(Boolean).join("  |  "),{size:8,color:muted,gap:0});
    y-=5;
    const top=y;
    const leftLines=[c.company && c.company !== "None" ? c.company : "",c.name,c.abn ? "ABN " + c.abn : "",c.billing_address,c.email,c.phone,ctx.customer?.number].filter(Boolean).flatMap(v=>wrap(v,230,9));
    const jobLines=(ctx.credit ? [d.number,b.title] : [b.title || j.data?.title || "Job details",b.site_address,j.number]).filter(Boolean).flatMap(v=>wrap(v,230,9));
    const cardHeight = Math.max(leftLines.length,jobLines.length)*13+43;
    page.drawRectangle({x:40,y:top-cardHeight,width:515,height:cardHeight,color:light,borderColor:grid,borderWidth:0.65});
    page.drawLine({start:{x:299,y:top},end:{x:299,y:top-cardHeight},thickness:0.6,color:grid});
    page.drawLine({start:{x:40,y:top-27},end:{x:555,y:top-27},thickness:0.6,color:grid});
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
      const shortScope = b.scope?.length && wrap(b.scope.map((s,i)=>`${i+1}. ${s}`).join("\n"),495,9).length <= 5;
      const scopeOnPricingPage = shortScope && y > 450;
      if (scopeOnPricingPage) {
        section("Scope of works");
        para(b.scope.map((s,i)=>`${i+1}. ${s}`).join("\n"));
      }
      const receiptRows = d.kind === "invoice" ? (ctx.payments || []).filter(p => p.invoice_id === d.id).length : 0;
      const summaryRows = 2 + Number(!!t.adjustment_cents) + Number(!!t.fee_cents) + Number(!!t.discount_cents)
        + (d.kind === "invoice" ? receiptRows + Number(!!d.credit_cents) : 2);
      const summaryHeight = 90 + summaryRows * 18 + (d.kind === "invoice" ? 36 : 0)
        + (b.tax !== "taxable" ? wrap("Tax treatment: " + b.tax + " - " + (b.tax_reason || "Basis not supplied"),495,8).length * 12 + 15 : 0);
      const itemHeight = t.items.reduce((sum,i) => sum + Math.max(wrap(i.description || "Description not provided",258,9).length,wrap(String(i.quantity)+" "+(i.unit || ""),70,8).length)*14+10,0);
      // Keep an ordinary cost table and its complete totals together. Oversized
      // lists paginate at a readable size instead of shrinking or clipping.
      const pricingHeight = 78 + itemHeight + summaryHeight;
      if (pricingHeight <= 691) ensure(pricingHeight);
      for (const [category, label] of [[null, "Itemised costs"]]) {
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
            const rowHeight = chunk.length * 14 + 10;
            page.drawRectangle({x:40,y:y-rowHeight+12,width:515,height:rowHeight,borderColor:grid,borderWidth:0.55});
            for (const x of [309,389,475]) page.drawLine({start:{x,y:y+12},end:{x,y:y-rowHeight+12},color:grid,thickness:0.5});
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
      ensure(Math.min(summaryHeight, 691));
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
      // Supporting information always starts after the pricing pages.
      newPage();
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
      }
      for (const [key, label] of [["exclusions","Exclusions"],["assumptions","Material assumptions"]]) {
        if (b[key]) { section(label); para(b[key]); }
      }
      if (d.kind === "quote") {
        section("Customer acceptance (optional)");
        para("Name: __________________________________________\nSignature: _______________________________________\nDate: ___________________________________________", {color:muted});
      }
      if (b.scope?.length && !scopeOnPricingPage) {
        section("Scope of works");
        para(b.scope.map((s,i)=>`${i+1}. ${s}`).join("\n"));
      }
      if (b.notes) { section("Additional notes"); para(b.notes); }
      if (b.terms) {
        const termsLines=wrap(b.terms,495,8.5);
        if(termsLines.length*12.5+45 > y-65 && y < 600) newPage();
        section("Terms & conditions");
        para(b.terms,{size:8.5,color:muted,gap:6});
      }
      if (d.kind === "booking" && b.special_instructions) {
        section("Special instructions");
        para(b.special_instructions);
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
